const Asset = require("../models/Asset");
const Budget = require("../models/Budget");
const AssetHistory = require("../models/AssetHistory");
const { STATUS_KEYS, statusFromLabel } = require("../constants/status");
const { parseWorkbook } = require("../services/import.service");
const { getBudgetMap } = require("../services/budget.service");
const { classify, rowLocationLabel } = require("../services/importCompare");

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const PREVIEW_LIMIT = 300;

function readUpload(req) {
  if (!req.file) {
    const err = new Error("กรุณาแนบไฟล์ Excel");
    err.status = 400;
    throw err;
  }
  return parseWorkbook(req.file.buffer);
}

const parseJson = (s) => {
  try { return s ? JSON.parse(s) : {}; } catch { return {}; }
};

// ครุภัณฑ์ทั้งหมดที่ยังไม่ถูกลบ — ใช้เทียบกับไฟล์
const loadAssets = () =>
  Asset.find({ isDeleted: false }, { assetCode: 1, name: 1, status: 1, location: 1, holderName: 1, brand: 1 }).lean();

const statusResolver = (statusMapping = {}) => (r) => {
  const k = r.statusKey || statusMapping[r.statusLabel];
  return STATUS_KEYS.includes(k) ? k : null;
};

const brief = (a) => ({ id: String(a._id), code: a.assetCode, name: a.name, room: a.location?.label || "", status: a.status });

// POST /api/assets/import/preview — อ่านไฟล์ เทียบกับระบบ ยังไม่บันทึก
exports.preview = async (req, res) => {
  try {
    const parsed = readUpload(req);
    const [budgetMap, assets] = await Promise.all([getBudgetMap(), loadAssets()]);
    const c = classify(parsed.rows, assets, statusResolver());

    // สถานะ/งบที่ไม่รู้จัก — นับจากแถวใหม่และแถวที่มีอยู่แล้ว (ต้องรู้ค่าก่อนจะเทียบสถานะได้)
    const unknownStatuses = new Map();
    const unknownBudgets = new Map();
    let unrecognizedCodes = 0;
    const consider = [...c.fresh, ...c.same.map((x) => x.row), ...c.changed.map((x) => x.row)];
    for (const r of consider) {
      if (!r.statusKey) unknownStatuses.set(r.statusLabel, (unknownStatuses.get(r.statusLabel) || 0) + 1);
    }
    for (const r of c.fresh) {
      if (!r.codeRecognized) unrecognizedCodes++;
      else if (!budgetMap.has(r.budgetAbbr)) {
        const u = unknownBudgets.get(r.budgetAbbr) || { abbr: r.budgetAbbr, count: 0, example: r.data.assetCode };
        u.count++;
        unknownBudgets.set(r.budgetAbbr, u);
      }
    }

    const sameRows = new Set(c.same.map((x) => x.row.row));
    const changedRows = new Set(c.changed.map((x) => x.row.row));

    res.json({
      success: true,
      headerRow: parsed.headerRow,
      headers: parsed.headers,
      unknownColumns: parsed.unknownColumns,
      totalRows: parsed.rows.length,
      newRows: c.fresh.length,
      readyRows: c.fresh.length, // จำนวนที่จะ "เพิ่มใหม่"
      sameRows: c.same.length,
      duplicates: c.same.length + c.changed.length, // คงไว้ให้หน้าเว็บเดิมใช้ได้
      dupInFile: c.dupInFile.map((r) => ({ row: r.row, reason: "ซ้ำกับแถวก่อนหน้าในไฟล์ (เลขและชื่อเดียวกัน)" })),
      unrecognizedCodes,
      errors: c.invalid.map((r) => ({ row: r.row, reason: r.errors.join(", ") })),
      unknownStatuses: [...unknownStatuses].map(([label, count]) => ({ label, count })),
      unknownBudgets: [...unknownBudgets.values()],
      budgets: [...new Set(budgetMap.values())],
      statuses: STATUS_KEYS,
      // ต่างจากในระบบ — Admin เลือกรายฟิลด์ว่าจะใช้ค่าจากไฟล์หรือคงค่าเดิม
      changed: c.changed.slice(0, PREVIEW_LIMIT).map((x) => ({
        row: x.row.row, assetId: String(x.asset._id), code: x.asset.assetCode, name: x.asset.name, diffs: x.diffs
      })),
      changedTotal: c.changed.length,
      // ในระบบแต่ไม่อยู่ในไฟล์ — แจ้งให้ตรวจสอบ ไม่เปลี่ยนอะไรอัตโนมัติ
      missing: c.missing.slice(0, PREVIEW_LIMIT).map(brief),
      missingTotal: c.missing.length,
      sample: parsed.rows.slice(0, 20).map((r) => ({
        row: r.row,
        ...r.data,
        statusLabel: r.statusLabel,
        statusKey: r.statusKey,
        budgetAbbr: r.budgetAbbr,
        budget: r.budgetAbbr ? budgetMap.get(r.budgetAbbr) || null : null,
        duplicate: sameRows.has(r.row) || changedRows.has(r.row),
        changed: changedRows.has(r.row),
        errors: r.errors
      }))
    });
  } catch (error) {
    fail(res, error.status || 500, error.message);
  }
};

// POST /api/assets/import — บันทึกจริง
// body (multipart): file, statusMapping {"ป้ายเดิม": key}, budgetMapping {"ตัวย่อ": "ชื่องบ"},
//   updates {"<assetId>": ["status","location",...]} = ฟิลด์ที่ Admin เลือกใช้ค่าจากไฟล์
exports.commit = async (req, res) => {
  try {
    const parsed = readUpload(req);
    const statusMapping = parseJson(req.body.statusMapping);
    const budgetMapping = parseJson(req.body.budgetMapping);
    const updates = parseJson(req.body.updates);

    // บันทึกตัวย่องบใหม่ที่ Admin เลือก (งบที่เพิ่มตอน Import ถือเป็นงบในอดีต)
    for (const [abbr, name] of Object.entries(budgetMapping)) {
      if (abbr && name && String(name).trim()) {
        await Budget.updateOne({ abbr }, { $setOnInsert: { abbr, name: String(name).trim(), active: false } }, { upsert: true });
      }
    }
    const [budgetMap, assets] = await Promise.all([getBudgetMap(), loadAssets()]);
    const resolve = statusResolver(statusMapping);
    const c = classify(parsed.rows, assets, resolve);
    const who = { changedBy: req.user?.userId, changedByName: req.user?.name || req.user?.username };

    const failedRows = c.invalid.map((r) => ({ row: r.row, reason: r.errors.join(", ") }));
    const skippedRows = c.dupInFile.map((r) => ({ row: r.row, reason: "ซ้ำกับแถวก่อนหน้าในไฟล์" }));

    // 1) เพิ่มรายการใหม่
    const docs = [];
    for (const r of c.fresh) {
      const status = resolve(r);
      if (!status) {
        failedRows.push({ row: r.row, reason: `ไม่รู้จักสถานะ "${r.statusLabel}"` });
        continue;
      }
      docs.push({
        ...r.data,
        status,
        budget: (r.budgetAbbr && budgetMap.get(r.budgetAbbr)) || "ไม่ระบุ",
        legacy: { ...r.raw, _row: r.row, _file: req.file.originalname, _importedAt: new Date() }
      });
    }
    let inserted = [];
    if (docs.length) {
      try {
        inserted = await Asset.insertMany(docs, { ordered: false });
      } catch (e) {
        inserted = e.insertedDocs || [];
        for (const we of e.writeErrors || []) {
          failedRows.push({ row: docs[we.index]?.legacy?._row, reason: we.errmsg || "บันทึกไม่สำเร็จ" });
        }
      }
    }
    if (inserted.length) {
      await AssetHistory.insertMany(inserted.map((a) => ({ asset: a._id, action: "import", ...who })));
    }

    // 2) อัปเดตรายการที่ต่างกัน เฉพาะฟิลด์ที่ Admin เลือก — ค่าเดิมถูกเก็บในประวัติ (ก่อน → หลัง)
    let updatedCount = 0;
    for (const x of c.changed) {
      const chosen = new Set(updates[String(x.asset._id)] || []);
      const apply = x.diffs.filter((d) => chosen.has(d.field));
      if (!apply.length) {
        skippedRows.push({ row: x.row.row, reason: "คงค่าในระบบ (ไม่ได้เลือกใช้ค่าจากไฟล์)" });
        continue;
      }
      const asset = await Asset.findById(x.asset._id);
      if (!asset || asset.isDeleted) continue;
      for (const d of apply) {
        if (d.field === "location") asset.location = { ...x.row.data.location, label: rowLocationLabel(x.row.data.location) };
        else asset[d.field] = d.incoming;
      }
      await asset.save();
      await AssetHistory.create({
        asset: asset._id,
        action: "import",
        changes: apply.map((d) => ({
          field: d.field === "location" ? "location" : d.field,
          oldValue: d.current,
          newValue: d.incoming
        })),
        ...who
      });
      updatedCount++;
    }

    res.json({
      success: true,
      successCount: inserted.length,
      updatedCount,
      sameCount: c.same.length,
      skippedCount: skippedRows.length,
      skippedRows,
      failedRows: failedRows.sort((a, b) => (a.row || 0) - (b.row || 0))
    });
  } catch (error) {
    fail(res, error.status || 500, error.message);
  }
};

// GET /api/assets/import/template — ดาวน์โหลดไฟล์ Template
exports.template = (req, res) => {
  const XLSX = require("xlsx");
  const headers = ["ตึก/อาคาร", "ชั้น", "ห้อง", "ระบุ สถานที่ใช้งาน", "สภาพ", "รหัสสินทรัพย์อ้างอิง", "ชื่อสินทรัพย์", "ยี่ห้อ", "ผู้ถือครอง"];
  const example = ["บร.2", "1", "107", "บร.2 ชั้น 1 ห้อง 107", "ปกติ", "วทท-8พ-57-1/80", "เทคโนโลยีสารสนเทศเพื่อการเรียนการสอน", "DELL", ""];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(10, h.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ครุภัณฑ์");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''aimslog-template.xlsx");
  res.send(buf);
};
