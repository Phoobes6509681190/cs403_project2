const Asset = require("../models/Asset");
const Budget = require("../models/Budget");
const AssetHistory = require("../models/AssetHistory");
const { STATUS_KEYS, statusFromLabel } = require("../constants/status");
const { parseWorkbook } = require("../services/import.service");
const { getBudgetMap } = require("../services/budget.service");

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const dupKey = (code, name) => `${code}\u0000${name}`;

function readUpload(req) {
  if (!req.file) {
    const err = new Error("กรุณาแนบไฟล์ Excel");
    err.status = 400;
    throw err;
  }
  return parseWorkbook(req.file.buffer);
}

// หา key ของรายการที่มีอยู่แล้วในระบบ (เลข + ชื่อ ตรงกัน) — ใช้กันนำเข้าซ้ำเมื่อคณะส่งไฟล์ใหม่มาทุกปี
async function existingKeys(rows) {
  const codes = [...new Set(rows.map((r) => r.data.assetCode).filter(Boolean))];
  const found = await Asset.find({ isDeleted: false, assetCode: { $in: codes } }, { assetCode: 1, name: 1 }).lean();
  return new Set(found.map((a) => dupKey(a.assetCode, a.name)));
}

// POST /api/assets/import/preview — อ่านไฟล์และตรวจสอบ ยังไม่บันทึก
exports.preview = async (req, res) => {
  try {
    const parsed = readUpload(req);
    const budgetMap = await getBudgetMap();
    const existing = await existingKeys(parsed.rows);

    const unknownStatuses = new Map();
    const unknownBudgets = new Map();
    let duplicates = 0;
    let unrecognizedCodes = 0;

    for (const r of parsed.rows) {
      if (r.errors.length) continue;
      if (existing.has(dupKey(r.data.assetCode, r.data.name))) {
        r.duplicate = true;
        duplicates++;
        continue;
      }
      if (!r.statusKey) unknownStatuses.set(r.statusLabel, (unknownStatuses.get(r.statusLabel) || 0) + 1);
      if (!r.codeRecognized) unrecognizedCodes++;
      else if (!budgetMap.has(r.budgetAbbr)) {
        const u = unknownBudgets.get(r.budgetAbbr) || { abbr: r.budgetAbbr, count: 0, example: r.data.assetCode };
        u.count++;
        unknownBudgets.set(r.budgetAbbr, u);
      }
    }

    const errorRows = parsed.rows.filter((r) => r.errors.length);
    res.json({
      success: true,
      headerRow: parsed.headerRow,
      headers: parsed.headers,
      unknownColumns: parsed.unknownColumns,
      totalRows: parsed.rows.length,
      readyRows: parsed.rows.length - errorRows.length - duplicates,
      duplicates,
      unrecognizedCodes,
      errors: errorRows.map((r) => ({ row: r.row, reason: r.errors.join(", ") })),
      unknownStatuses: [...unknownStatuses].map(([label, count]) => ({ label, count })),
      unknownBudgets: [...unknownBudgets.values()],
      budgets: [...new Set(budgetMap.values())],
      statuses: STATUS_KEYS,
      sample: parsed.rows.slice(0, 20).map((r) => ({
        row: r.row,
        ...r.data,
        statusLabel: r.statusLabel,
        statusKey: r.statusKey,
        budgetAbbr: r.budgetAbbr,
        budget: r.budgetAbbr ? budgetMap.get(r.budgetAbbr) || null : null,
        duplicate: !!r.duplicate,
        errors: r.errors
      }))
    });
  } catch (error) {
    fail(res, error.status || 500, error.message);
  }
};

// POST /api/assets/import — บันทึกจริง
// body (multipart): file, statusMapping = {"ป้ายเดิม": "statusKey"}, budgetMapping = {"ตัวย่อ": "ชื่องบ"}
exports.commit = async (req, res) => {
  try {
    const parsed = readUpload(req);
    const parseJson = (s) => {
      try { return s ? JSON.parse(s) : {}; } catch { return {}; }
    };
    const statusMapping = parseJson(req.body.statusMapping);
    const budgetMapping = parseJson(req.body.budgetMapping);

    // บันทึกตัวย่องบใหม่ที่ Admin เลือก — ครั้งต่อไประบบจะรู้จักเอง
    // งบที่เพิ่มตอน Import ถือเป็นงบในอดีต (active=false) เพราะงบปัจจุบันมีแค่ พ / กท
    for (const [abbr, name] of Object.entries(budgetMapping)) {
      if (abbr && name && String(name).trim()) {
        await Budget.updateOne(
          { abbr },
          { $setOnInsert: { abbr, name: String(name).trim(), active: false } },
          { upsert: true }
        );
      }
    }
    const budgetMap = await getBudgetMap();
    const existing = await existingKeys(parsed.rows);

    const failedRows = [];
    const skippedRows = [];
    const docs = [];

    for (const r of parsed.rows) {
      if (r.errors.length) {
        failedRows.push({ row: r.row, reason: r.errors.join(", ") });
        continue;
      }
      const key = dupKey(r.data.assetCode, r.data.name);
      if (existing.has(key)) {
        skippedRows.push({ row: r.row, reason: "มีอยู่ในระบบแล้ว (เลขและชื่อตรงกัน)" });
        continue;
      }
      const status = r.statusKey || statusMapping[r.statusLabel] || statusFromLabel(statusMapping[r.statusLabel]);
      if (!STATUS_KEYS.includes(status)) {
        failedRows.push({ row: r.row, reason: `ไม่รู้จักสถานะ "${r.statusLabel}"` });
        continue;
      }
      existing.add(key);
      docs.push({
        ...r.data,
        status,
        budget: (r.budgetAbbr && budgetMap.get(r.budgetAbbr)) || "ไม่ระบุ",
        legacy: { ...r.raw, _row: r.row, _file: req.file.originalname, _importedAt: new Date() }
      });
    }

    // insertMany ข้ามเอกสารที่ผิด validation รายตัว (ordered:false) แล้วรายงานกลับ
    let inserted = [];
    if (docs.length) {
      try {
        inserted = await Asset.insertMany(docs, { ordered: false, rawResult: false });
      } catch (e) {
        inserted = e.insertedDocs || [];
        for (const we of e.writeErrors || []) {
          failedRows.push({ row: docs[we.index]?.legacy?._row, reason: we.errmsg || "บันทึกไม่สำเร็จ" });
        }
      }
    }

    if (inserted.length) {
      await AssetHistory.insertMany(
        inserted.map((a) => ({
          asset: a._id,
          action: "import",
          changedBy: req.user?.userId,
          changedByName: req.user?.name || req.user?.username
        }))
      );
    }

    res.json({
      success: true,
      successCount: inserted.length,
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
