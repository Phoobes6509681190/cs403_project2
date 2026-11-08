const mongoose = require("mongoose");
const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");
const { STATUS_KEYS } = require("../constants/status");
const escapeRegex = require("../utils/escapeRegex");
const { getBudgetMap, budgetNameFromCode } = require("../services/budget.service");
const { toAssetDto, fromAssetInput, toHistoryDto } = require("../services/assetDto");
const InspectionItem = require("../models/InspectionItem");
const { getOpenInspection, canInspectItem } = require("../services/inspection.service");

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const isId = (id) => mongoose.isValidObjectId(id);
const actor = (req) => ({ changedBy: req.user?.userId, changedByName: req.user?.name || req.user?.username });

// ฟิลด์ที่บันทึกประวัติ (ตอบโจทย์ "ของย้ายไปไหน ใครถือ")
const TRACKED = [
  ["status", (a) => a.status],
  ["location", (a) => a.location?.label || ""],
  ["holderName", (a) => a.holderName || ""]
];

function applyInput(asset, input) {
  const { locationLabel, location, ...rest } = input;
  Object.assign(asset, rest);
  if (location) asset.location = location;
  else if (locationLabel !== undefined) {
    // แก้จากช่อง "สถานที่" ช่องเดียวในฟอร์ม — ล้างค่าแยกส่วนเดิมที่อาจไม่ตรงแล้ว
    asset.location = { label: locationLabel };
  }
}

// GET /api/assets?q=&status=&room=&budget=&page=1&perPage=10
exports.getAssets = async (req, res) => {
  try {
    const { q, status, room, budget, holder } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.perPage, 10) || 20));

    const filter = { isDeleted: false };
    if (status && STATUS_KEYS.includes(status)) filter.status = status;
    if (room) filter["location.label"] = String(room);
    if (budget) filter.budget = String(budget);
    if (holder) filter.holderName = String(holder);
    if (q && String(q).trim()) {
      const re = new RegExp(escapeRegex(String(q).trim()), "i");
      filter.$or = [
        { assetCode: re }, { name: re }, { brand: re }, { model: re },
        { holderName: re }, { "location.label": re }
      ];
    }

    const [items, total, rooms, budgets] = await Promise.all([
      Asset.find(filter).sort({ "codeParts.year": -1, "codeParts.total": 1, "codeParts.seq": 1, _id: 1 })
        .skip((page - 1) * perPage).limit(perPage).lean(),
      Asset.countDocuments(filter),
      Asset.distinct("location.label", { isDeleted: false }),
      Asset.distinct("budget", { isDeleted: false })
    ]);

    res.json({
      success: true,
      items: items.map(toAssetDto),
      total,
      page,
      perPage,
      rooms: rooms.filter(Boolean).sort(),
      budgets: budgets.filter(Boolean).sort()
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/assets/:id
exports.getAsset = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "ไม่พบครุภัณฑ์");
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false }).lean();
    if (!asset) return fail(res, 404, "ไม่พบครุภัณฑ์");

    // ถ้ามีรอบตรวจนับเปิดอยู่ แนบสถานะการตรวจของชิ้นนี้ — สแกน QR แล้วกดตรวจจากหน้านี้ได้เลย
    let inspection = null;
    const open = await getOpenInspection();
    if (open) {
      const item = await InspectionItem.findOne({ inspection: open._id, asset: asset._id }).lean();
      if (item) {
        inspection = {
          id: String(open._id),
          budgetYear: open.budgetYear,
          checked: !!item.result,
          result: item.result,
          checkedBy: item.checkedByName || "",
          checkedAt: item.checkedAt || null,
          canInspect: canInspectItem(open, item, req.user)
        };
      }
    }
    res.json({ ...toAssetDto(asset), inspection });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/assets (admin)
exports.createAsset = async (req, res) => {
  try {
    const input = fromAssetInput(req.body);
    const asset = new Asset();
    applyInput(asset, input);
    if (!asset.budget || asset.budget === "ไม่ระบุ") {
      asset.budget = budgetNameFromCode(asset.assetCode, await getBudgetMap()) || "ไม่ระบุ";
    }
    await asset.save();
    await AssetHistory.create({ asset: asset._id, action: "create", ...actor(req) });
    res.status(201).json(toAssetDto(asset));
  } catch (error) {
    fail(res, 400, error.message);
  }
};

// PUT /api/assets/:id (admin)
exports.updateAsset = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "ไม่พบครุภัณฑ์");
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return fail(res, 404, "ไม่พบครุภัณฑ์");

    const before = TRACKED.map(([f, get]) => [f, get(asset)]);
    const input = fromAssetInput(req.body);
    applyInput(asset, input);
    if (input.assetCode !== undefined && input.budget === undefined) {
      asset.budget = budgetNameFromCode(asset.assetCode, await getBudgetMap()) || asset.budget;
    }
    await asset.save();

    // ผูกบัญชีผู้ถือครองใหม่ -> ให้ผู้ถือคนใหม่ยืนยันในรอบที่เปิดอยู่ได้ทันที
    if (input.holderUser !== undefined) {
      const open = await getOpenInspection();
      if (open) {
        await InspectionItem.updateOne(
          { inspection: open._id, asset: asset._id },
          { holderUser: asset.holderUser || null, "snapshot.holderName": asset.holderName || "" }
        );
      }
    }

    const changes = before
      .map(([field, oldValue], i) => ({ field, oldValue, newValue: TRACKED[i][1](asset) }))
      .filter((c) => c.oldValue !== c.newValue);
    if (changes.length) {
      await AssetHistory.create({ asset: asset._id, action: "update", changes, ...actor(req) });
    }

    res.json(toAssetDto(asset));
  } catch (error) {
    fail(res, 400, error.message);
  }
};

// DELETE /api/assets/:id (admin) — soft delete
exports.deleteAsset = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "ไม่พบครุภัณฑ์");
    const asset = await Asset.findOneAndUpdate(
      { _id: req.params.id, isDeleted: false },
      { isDeleted: true },
      { returnDocument: "after" }
    );
    if (!asset) return fail(res, 404, "ไม่พบครุภัณฑ์");
    await AssetHistory.create({ asset: asset._id, action: "delete", ...actor(req) });
    res.json({ success: true });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/assets/:id/history
exports.getAssetHistory = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "ไม่พบครุภัณฑ์");
    const history = await AssetHistory.find({ asset: req.params.id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, items: history.map(toHistoryDto) });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
