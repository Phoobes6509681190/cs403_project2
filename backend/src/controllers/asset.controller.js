const mongoose = require("mongoose");
const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");
const { STATUS_KEYS, NOT_COUNTED } = require("../constants/status");
const escapeRegex = require("../utils/escapeRegex");
const { getBudgetMap, budgetNameFromCode } = require("../services/budget.service");
const { toAssetDto, fromAssetInput, toHistoryDto } = require("../services/assetDto");
const InspectionItem = require("../models/InspectionItem");
const { getOpenInspection, canInspectItem, isCommittee } = require("../services/inspection.service");
const { isEditor } = require("../constants/roles");

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const isId = (id) => mongoose.isValidObjectId(id);
const actor = (req) => ({ changedBy: req.user?.userId, changedByName: req.user?.name || req.user?.username });

// ฟิลด์ที่บันทึกประวัติ (ตอบโจทย์ "ของย้ายไปไหน ใครถือ")
const TRACKED = [
  ["status", (a) => a.status],
  ["location", (a) => a.location?.label || ""],
  ["holderName", (a) => a.holderName || ""],
  ["assetCode", (a) => a.assetCode || ""],
  ["name", (a) => a.name || ""],
  ["brand", (a) => a.brand || ""],
  ["model", (a) => a.model || ""],
  ["category", (a) => a.category || ""],
  ["budget", (a) => a.budget || ""],
  ["price", (a) => (a.price === undefined || a.price === null ? "" : String(a.price))],
  ["note", (a) => a.note || ""]
];

// กรรมการตรวจนับ (ที่ไม่ใช่ผู้ดูแล/ผู้ใช้) แก้ข้อมูลที่ขาดได้ระหว่างรอบที่เปิด — เฉพาะช่องรายละเอียด
// ห้ามแก้เลขครุภัณฑ์ งบ ราคา สถานะ (สถานะต้องเปลี่ยนผ่านผลตรวจ)
const COMMITTEE_FIELDS = ["name", "brand", "model", "category", "location", "locationLabel", "holderName", "note"];

function applyInput(asset, input) {
  const { locationLabel, location, ...rest } = input;
  Object.assign(asset, rest);
  if (location) asset.location = location;
  else if (locationLabel !== undefined) {
    // แก้จากช่อง "สถานที่" ช่องเดียวในฟอร์ม — ล้างค่าแยกส่วนเดิมที่อาจไม่ตรงแล้ว
    asset.location = { label: locationLabel };
  }
}

// คอลัมน์ที่กรองแบบค่าตรงตัวได้ และเรียงลำดับได้ (ชื่อพารามิเตอร์ -> ฟิลด์ใน DB)
const COLUMN_FILTERS = {
  building: "location.building", floor: "location.floor", roomNo: "location.room",
  cat: "category", brand: "brand", model: "model", code: "assetCode", name: "name"
};
const SORTS = {
  building: "location.building", floor: "location.floor", roomNo: "location.room", room: "location.label",
  status: "status", code: "assetCode", name: "name", brand: "brand", model: "model", cat: "category",
  owner: "holderName", budget: "budget", createdAt: "createdAt"
};

// ตัวกรองเดียวกันทั้งหน้ารายการและ "ลบทั้งหมดตามตัวกรอง"
function buildFilter(query = {}, user) {
  const { q, status, room, budget, holder } = query;
  const filter = { isDeleted: false };
  if (status && STATUS_KEYS.includes(status)) filter.status = status;
  if (room) filter["location.label"] = String(room);
  if (budget) filter.budget = String(budget);
  if (holder) filter.holderName = String(holder);
  // กรองรายคอลัมน์ (ค่าตรงตัว จาก dropdown)
  for (const [param, path] of Object.entries(COLUMN_FILTERS)) {
    if (query[param] !== undefined && query[param] !== "") filter[path] = String(query[param]);
  }
  // ?year=57 — ปีงบประมาณจากเลขครุภัณฑ์ (ใช้กับ "ลบทั้งหมดของปีนั้น")
  const year = parseInt(query.year, 10);
  if (Number.isFinite(year)) filter["codeParts.year"] = year;
  // ?holderUser=me — ครุภัณฑ์ที่ฉันถือครอง (หน้าโปรไฟล์)
  if (query.holderUser === "me" && user) filter.holderUser = user.userId;
  // ?qr=unprinted — เฉพาะชิ้นที่ยังไม่เคยพิมพ์สติกเกอร์ QR (เช่น ของที่เพิ่ง import เข้ามา)
  if (query.qr === "unprinted") filter.qrPrintedAt = null;
  if (q && String(q).trim()) {
    const re = new RegExp(escapeRegex(String(q).trim()), "i");
    filter.$or = [
      { assetCode: re }, { name: re }, { brand: re }, { model: re },
      { holderName: re }, { "location.label": re }
    ];
  }
  return filter;
}

// ?sort=name&dir=asc|desc (หรือ sort=-createdAt แบบเดิม) — ไม่ระบุ = เรียงตามปีงบล่าสุดและลำดับชิ้น
function sortOf(query) {
  const raw = String(query.sort || "");
  const desc = raw.startsWith("-") || query.dir === "desc";
  const path = SORTS[raw.replace(/^-/, "")];
  if (!path) return { "codeParts.year": -1, "codeParts.total": 1, "codeParts.seq": 1, _id: 1 };
  return { [path]: desc ? -1 : 1, _id: desc ? -1 : 1 };
}

// GET /api/assets/options — ค่าที่มีอยู่แล้วของแต่ละช่อง (ทำ dropdown ที่พิมพ์ค้นหาได้ แทนการพิมพ์อิสระ)
exports.getOptions = async (req, res) => {
  try {
    const live = { isDeleted: false };
    const fields = { building: "location.building", floor: "location.floor", roomNo: "location.room", room: "location.label",
      cat: "category", brand: "brand", model: "model", owner: "holderName", budget: "budget" };
    const entries = await Promise.all(
      Object.entries(fields).map(async ([k, path]) => [k, (await Asset.distinct(path, live)).filter((v) => v !== null && v !== "").map(String).sort((a, b) => a.localeCompare(b, "th", { numeric: true }))])
    );
    res.json({ success: true, ...Object.fromEntries(entries) });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/assets?q=&status=&room=&budget=&page=1&perPage=10
exports.getAssets = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.perPage, 10) || 20));

    const filter = buildFilter(req.query, req.user);

    const [items, total, rooms, budgets, qrUnprinted, years] = await Promise.all([
      Asset.find(filter).sort(sortOf(req.query))
        .skip((page - 1) * perPage).limit(perPage).lean(),
      Asset.countDocuments(filter),
      Asset.distinct("location.label", { isDeleted: false }),
      Asset.distinct("budget", { isDeleted: false }),
      Asset.countDocuments({ isDeleted: false, qrPrintedAt: null, status: { $nin: NOT_COUNTED } }),
      Asset.distinct("codeParts.year", { isDeleted: false })
    ]);

    res.json({
      success: true,
      items: items.map(toAssetDto),
      total,
      page,
      perPage,
      rooms: rooms.filter(Boolean).sort(),
      budgets: budgets.filter(Boolean).sort(),
      qrUnprinted,
      years: years.filter((y) => Number.isFinite(y)).sort((a, b) => b - a)
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
          note: item.note || "",
          canInspect: canInspectItem(open, item, req.user),
          // กรรมการรอบนี้แก้ข้อมูลที่ขาดได้ (เฉพาะช่องรายละเอียด)
          isCommittee: isCommittee(open, req.user)
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

// PUT /api/assets/:id (ผู้ดูแลระบบ/ผู้ใช้ — หรือกรรมการรอบที่เปิดอยู่ แก้ได้เฉพาะช่องรายละเอียด)
exports.updateAsset = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "ไม่พบครุภัณฑ์");
    let input = fromAssetInput(req.body);
    let byCommittee = false;
    if (!isEditor(req.user)) {
      const open = await getOpenInspection();
      if (!open || !isCommittee(open, req.user)) return fail(res, 403, "คุณไม่มีสิทธิ์แก้ไขข้อมูลนี้");
      const inRound = await InspectionItem.exists({ inspection: open._id, asset: req.params.id });
      if (!inRound) return fail(res, 403, "แก้ไขได้เฉพาะครุภัณฑ์ในรอบตรวจนับที่เปิดอยู่");
      input = Object.fromEntries(Object.entries(input).filter(([k]) => COMMITTEE_FIELDS.includes(k)));
      byCommittee = true;
    }
    const asset = await Asset.findOne({ _id: req.params.id, isDeleted: false });
    if (!asset) return fail(res, 404, "ไม่พบครุภัณฑ์");

    const before = TRACKED.map(([f, get]) => [f, get(asset)]);
    applyInput(asset, input);
    if (input.assetCode !== undefined && input.budget === undefined) {
      asset.budget = budgetNameFromCode(asset.assetCode, await getBudgetMap()) || asset.budget;
    }
    await asset.save();

    // ผูกบัญชีผู้ถือครองใหม่ -> ให้ผู้ถือคนใหม่ยืนยันในรอบที่เปิดอยู่ได้ทันที
    // อัปเดตสำเนาในรอบที่เปิดอยู่ให้ตรง (ชื่อ/สถานที่/ผู้ถือ) — ผูกบัญชีใหม่ก็ยืนยันเองได้ทันที
    const open = await getOpenInspection();
    if (open) {
      const snap = { "snapshot.name": asset.name, "snapshot.room": asset.location?.label || "", "snapshot.holderName": asset.holderName || "" };
      if (input.holderUser !== undefined) snap.holderUser = asset.holderUser || null;
      await InspectionItem.updateOne({ inspection: open._id, asset: asset._id }, snap);
    }

    const changes = before
      .map(([field, oldValue], i) => ({ field, oldValue, newValue: TRACKED[i][1](asset) }))
      .filter((c) => c.oldValue !== c.newValue);
    if (changes.length) {
      await AssetHistory.create({ asset: asset._id, action: byCommittee ? "inspect" : "update", changes, ...actor(req) });
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
      { isDeleted: true, deletedBy: req.user?.userId },
      { returnDocument: "after" }
    );
    if (!asset) return fail(res, 404, "ไม่พบครุภัณฑ์");
    await AssetHistory.create({ asset: asset._id, action: "delete", ...actor(req) });
    res.json({ success: true });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/assets/bulk-delete (admin) — ลบหลายชิ้นไปถังขยะ (soft delete, กู้คืนได้)
//   { ids: [...] }                         ลบชิ้นที่เลือก
//   { all: true, query: {q,status,...}, expected: N }  ลบทุกชิ้นตามตัวกรอง — expected ต้องตรงจำนวนที่พบ
//                                          (กันลบผิดเมื่อข้อมูลเปลี่ยนระหว่างที่หน้าเว็บเปิดค้าง)
exports.bulkDelete = async (req, res) => {
  try {
    const body = req.body || {};
    let filter;
    if (body.all === true) {
      const query = body.query && typeof body.query === "object" ? body.query : {};
      filter = buildFilter(query);
      const count = await Asset.countDocuments(filter);
      if (count !== Number(body.expected)) {
        return fail(res, 409, `จำนวนรายการเปลี่ยนไป (พบ ${count} รายการ) กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง`);
      }
    } else {
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.map(String))].filter(isId) : [];
      if (!ids.length) return fail(res, 400, "ไม่ได้เลือกรายการ");
      if (ids.length > 5000) return fail(res, 400, "เลือกได้ไม่เกิน 5,000 รายการต่อครั้ง");
      filter = { _id: { $in: ids }, isDeleted: false };
    }
    const targets = await Asset.find(filter, { _id: 1 }).lean();
    if (!targets.length) return res.json({ success: true, deleted: 0 });
    const ids = targets.map((a) => a._id);
    await Asset.updateMany({ _id: { $in: ids }, isDeleted: false }, { isDeleted: true, deletedBy: req.user?.userId });
    await AssetHistory.insertMany(ids.map((id) => ({ asset: id, action: "delete", ...actor(req) })));
    res.json({ success: true, deleted: ids.length });
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

// GET /api/assets/trash (admin) — รายการที่ถูกลบ (soft delete) ล่าสุดก่อน
exports.getTrash = async (req, res) => {
  try {
    const items = await Asset.find({ isDeleted: true, ...ownTrash(req) }).sort({ updatedAt: -1 }).limit(500).lean();
    const ids = items.map((a) => a._id);
    const dels = await AssetHistory.find({ asset: { $in: ids }, action: "delete" }).sort({ createdAt: -1 }).lean();
    const lastDel = new Map();
    for (const d of dels) if (!lastDel.has(String(d.asset))) lastDel.set(String(d.asset), d);
    res.json({
      success: true,
      items: items.map((a) => {
        const d = lastDel.get(String(a._id));
        return { ...toAssetDto(a), deletedAt: d?.createdAt || a.updatedAt, deletedBy: d?.changedByName || "" };
      })
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/assets/:id/restore (admin) — กู้คืนจากถังขยะ
exports.restoreAsset = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "ไม่พบครุภัณฑ์ในถังขยะ");
    const asset = await Asset.findOneAndUpdate(
      { _id: req.params.id, isDeleted: true },
      { isDeleted: false, $unset: { deletedBy: 1 } },
      { returnDocument: "after" }
    );
    if (!asset) return fail(res, 404, "ไม่พบครุภัณฑ์ในถังขยะ");
    await AssetHistory.create({ asset: asset._id, action: "restore", ...actor(req) });
    res.json(toAssetDto(asset));
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// ลบถาวรจากถังขยะ (admin) — ลบได้เฉพาะรายการที่อยู่ในถังขยะแล้ว และกู้คืนไม่ได้อีก
// ผลตรวจนับย้อนหลังยังอยู่ (เก็บสำเนาข้อมูลไว้ใน InspectionItem) รายงานปีเก่าจึงไม่เปลี่ยน
// ถังขยะเห็นเฉพาะของที่ตัวเองลบ (ของเก่าที่ไม่รู้ว่าใครลบ ทุกคนเห็น)
const ownTrash = (req) => ({ $or: [{ deletedBy: req.user?.userId }, { deletedBy: { $exists: false } }, { deletedBy: null }] });

async function purge(filter) {
  const assets = await Asset.find({ ...filter, isDeleted: true }, { _id: 1 }).lean();
  const ids = assets.map((a) => a._id);
  if (ids.length) {
    await AssetHistory.deleteMany({ asset: { $in: ids } });
    await Asset.deleteMany({ _id: { $in: ids } });
  }
  return ids.length;
}

// DELETE /api/assets/:id/permanent
exports.purgeAsset = async (req, res) => {
  try {
    if (!isId(req.params.id)) return fail(res, 404, "ไม่พบครุภัณฑ์ในถังขยะ");
    const n = await purge({ _id: req.params.id });
    if (!n) return fail(res, 404, "ไม่พบครุภัณฑ์ในถังขยะ (ต้องย้ายไปถังขยะก่อนจึงลบถาวรได้)");
    res.json({ success: true, deleted: n });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// DELETE /api/assets/trash — ล้างถังขยะทั้งหมด
exports.emptyTrash = async (req, res) => {
  try {
    res.json({ success: true, deleted: await purge(ownTrash(req)) });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/assets/qr-printed (admin) body: { ids: [...] } — ทำเครื่องหมายว่าพิมพ์สติกเกอร์ QR แล้ว
exports.markQrPrinted = async (req, res) => {
  try {
    const ids = (Array.isArray(req.body?.ids) ? req.body.ids : []).filter(isId).slice(0, 5000);
    if (!ids.length) return fail(res, 400, "ไม่มีรายการ");
    const r = await Asset.updateMany({ _id: { $in: ids }, isDeleted: false }, { qrPrintedAt: new Date() });
    res.json({ success: true, updated: r.modifiedCount });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
