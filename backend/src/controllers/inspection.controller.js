const mongoose = require("mongoose");
const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");
const Inspection = require("../models/Inspection");
const InspectionItem = require("../models/InspectionItem");
const User = require("../models/User");
const {
  INSPECT_RESULTS, getOpenInspection, isCommittee, canInspectItem, progressOf
} = require("../services/inspection.service");

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const isId = (id) => mongoose.isValidObjectId(id);

const itemDto = (it, inspection, user) => ({
  id: String(it._id),
  assetId: String(it.asset),
  code: it.snapshot?.code,
  name: it.snapshot?.name,
  room: it.snapshot?.room,
  owner: it.snapshot?.holderName || "",
  budget: it.snapshot?.budget,
  statusBefore: it.snapshot?.statusBefore,
  status: it.result,
  checked: !!it.result,
  checkedBy: it.checkedByName || "",
  checkedAt: it.checkedAt || null,
  method: it.method || null,
  note: it.note || "",
  canInspect: canInspectItem(inspection, it, user)
});

async function inspectionDto(inspection, user, { withItems = true } = {}) {
  const committeeUsers = await User.find({ _id: { $in: inspection.committee } }, { name: 1, username: 1 }).lean();
  const committee = isCommittee(inspection, user);

  // กรรมการ/admin เห็นทุกชิ้น — ผู้ใช้ทั่วไปเห็นเฉพาะชิ้นที่ตัวเองถือครอง (self-check)
  let items = [];
  if (withItems) {
    const filter = { inspection: inspection._id };
    if (!committee) filter.holderUser = user.userId;
    items = await InspectionItem.find(filter).sort({ "snapshot.room": 1, "snapshot.code": 1 }).lean();
  }

  return {
    id: String(inspection._id),
    budgetYear: inspection.budgetYear,
    status: inspection.status,
    createdAt: inspection.createdAt,
    closedAt: inspection.closedAt || null,
    committee: committeeUsers.map((u) => ({ id: String(u._id), name: u.name, username: u.username })),
    isCommittee: committee,
    scope: committee ? "all" : "mine",
    results: INSPECT_RESULTS,
    items: items.map((it) => itemDto(it, inspection, user))
  };
}

async function loadInspection(req, res) {
  if (!isId(req.params.id)) {
    fail(res, 404, "ไม่พบรอบตรวจนับ");
    return null;
  }
  const inspection = await Inspection.findById(req.params.id);
  if (!inspection) fail(res, 404, "ไม่พบรอบตรวจนับ");
  return inspection;
}

async function validCommittee(ids) {
  const uniq = [...new Set((ids || []).map(String))].filter(isId);
  const users = await User.find({ _id: { $in: uniq } }, { _id: 1 }).lean();
  return users.map((u) => u._id);
}

// GET /api/inspections — รายการรอบทั้งหมด (ล่าสุดก่อน)
exports.list = async (req, res) => {
  try {
    const list = await Inspection.find().sort({ createdAt: -1 }).lean();
    const items = await Promise.all(
      list.map(async (i) => ({
        id: String(i._id),
        budgetYear: i.budgetYear,
        status: i.status,
        createdAt: i.createdAt,
        closedAt: i.closedAt || null,
        committeeCount: i.committee.length,
        progress: await progressOf(i._id)
      }))
    );
    res.json({ success: true, items });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/inspections/active — รอบที่เปิดอยู่ (null ถ้าไม่มี)
exports.active = async (req, res) => {
  try {
    const inspection = await getOpenInspection();
    res.json(inspection ? await inspectionDto(inspection, req.user) : null);
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/inspections/:id
exports.get = async (req, res) => {
  try {
    const inspection = await loadInspection(req, res);
    if (inspection) res.json(await inspectionDto(inspection, req.user));
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/inspections (admin) body: { budgetYear, committee: [{ userId }] | [userId] }
exports.create = async (req, res) => {
  try {
    if (await getOpenInspection()) return fail(res, 409, "มีรอบตรวจนับที่เปิดอยู่แล้ว กรุณาปิดรอบเดิมก่อน");

    const budgetYear = Number(req.body?.budgetYear);
    if (!Number.isInteger(budgetYear) || budgetYear < 2500 || budgetYear > 2700) {
      return fail(res, 400, "ปีงบประมาณไม่ถูกต้อง (ใช้ พ.ศ. เช่น 2569)");
    }
    const ids = (req.body?.committee || []).map((c) => (typeof c === "object" ? c.userId : c));
    const committee = await validCommittee(ids);
    if (!committee.length) return fail(res, 400, "เลือกกรรมการอย่างน้อย 1 คน");

    // ตรวจทุกชิ้นที่ยังอยู่ในความดูแลของสาขา (ไม่รวมที่ตัดโอนไปแล้ว)
    const assets = await Asset.find({ isDeleted: false, status: { $ne: "transferred" } }).lean();
    if (!assets.length) return fail(res, 400, "ยังไม่มีครุภัณฑ์ในระบบ");

    const inspection = await Inspection.create({
      budgetYear, committee, createdBy: req.user.userId, totalItems: assets.length
    });
    await InspectionItem.insertMany(
      assets.map((a) => ({
        inspection: inspection._id,
        asset: a._id,
        holderUser: a.holderUser,
        snapshot: {
          code: a.assetCode,
          name: a.name,
          room: a.location?.label || "",
          holderName: a.holderName || "",
          budget: a.budget,
          statusBefore: a.status
        }
      }))
    );

    res.status(201).json(await inspectionDto(inspection, req.user, { withItems: false }));
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/inspections/:id/items body: { assetId, status, note }
exports.submitItem = async (req, res) => {
  try {
    const inspection = await loadInspection(req, res);
    if (!inspection) return;
    if (inspection.status !== "open") return fail(res, 409, "รอบตรวจนับนี้ปิดแล้ว");

    const { assetId, status, note } = req.body || {};
    if (!INSPECT_RESULTS.includes(status)) return fail(res, 400, "ผลตรวจไม่ถูกต้อง");
    if (!isId(assetId)) return fail(res, 404, "ไม่พบครุภัณฑ์ในรอบนี้");

    const item = await InspectionItem.findOne({ inspection: inspection._id, asset: assetId });
    if (!item) return fail(res, 404, "ไม่พบครุภัณฑ์ในรอบนี้");
    if (!canInspectItem(inspection, item, req.user)) return fail(res, 403, "คุณไม่มีสิทธิ์ตรวจรายการนี้");

    const now = new Date();
    item.result = status;
    item.note = note ? String(note).slice(0, 500) : item.note;
    item.checkedBy = req.user.userId;
    item.checkedByName = req.user.name || req.user.username;
    item.checkedAt = now;
    item.method = isCommittee(inspection, req.user) ? "committee" : "self";
    await item.save();

    // อัปเดตสถานะจริงของครุภัณฑ์ + วันที่ตรวจล่าสุด และบันทึกประวัติถ้าสถานะเปลี่ยน
    const asset = await Asset.findById(assetId);
    if (asset) {
      const before = asset.status;
      asset.status = status;
      asset.lastInspectedAt = now;
      await asset.save();
      if (before !== status) {
        await AssetHistory.create({
          asset: asset._id,
          action: "inspect",
          changes: [{ field: "status", oldValue: before, newValue: status }],
          changedBy: req.user.userId,
          changedByName: req.user.name || req.user.username
        });
      }
    }

    res.json({ success: true, item: itemDto(item.toObject(), inspection, req.user) });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/inspections/:id/progress — ใช้ polling ทุก 3 วิ
exports.progress = async (req, res) => {
  try {
    const inspection = await loadInspection(req, res);
    if (inspection) res.json(await progressOf(inspection._id));
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// PUT /api/inspections/:id/close (admin)
exports.close = async (req, res) => {
  try {
    const inspection = await loadInspection(req, res);
    if (!inspection) return;
    if (inspection.status === "closed") return fail(res, 409, "รอบนี้ปิดไปแล้ว");
    inspection.status = "closed";
    inspection.closedAt = new Date();
    inspection.closedBy = req.user.userId;
    await inspection.save();
    res.json({ success: true, progress: await progressOf(inspection._id) });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/inspections/:id/committee (admin) body: { members: [userId] } — แทนที่รายชื่อเดิม
exports.setCommittee = async (req, res) => {
  try {
    const inspection = await loadInspection(req, res);
    if (!inspection) return;
    if (inspection.status !== "open") return fail(res, 409, "รอบนี้ปิดแล้ว");
    const committee = await validCommittee(req.body?.members);
    if (!committee.length) return fail(res, 400, "เลือกกรรมการอย่างน้อย 1 คน");
    inspection.committee = committee;
    await inspection.save();
    res.json(await inspectionDto(inspection, req.user, { withItems: false }));
  } catch (error) {
    fail(res, 500, error.message);
  }
};
