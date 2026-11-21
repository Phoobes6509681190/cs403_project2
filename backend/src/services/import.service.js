const XLSX = require("xlsx");
const { statusFromLabel, normalizeLabel } = require("../constants/status");
const { parseAssetCode } = require("../utils/assetCode");

// ช่องในระบบที่จับคู่กับคอลัมน์ในไฟล์ได้ (label = ชื่อที่แสดงในหน้าจับคู่คอลัมน์)
// aliases = ชื่อหัวคอลัมน์ที่ระบบเดาให้อัตโนมัติ (เทียบแบบตัดช่องว่าง) — แต่ละปีไฟล์ใช้ชื่อไม่เหมือนกัน
// ผู้ใช้จึงเลือกเองได้ทุกช่องในหน้า Import
const FIELDS = [
  { key: "assetCode", label: "เลขครุภัณฑ์", required: true, aliases: ["รหัสสินทรัพย์อ้างอิง", "Ref No. 1", "RefNo.1", "รหัสสินทรัพย์", "รหัสครุภัณฑ์", "เลขครุภัณฑ์", "หมายเลขครุภัณฑ์"] },
  { key: "name", label: "ชื่อครุภัณฑ์", required: true, aliases: ["ชื่อสินทรัพย์", "ชื่อครุภัณฑ์", "รายการ"] },
  { key: "status", label: "สภาพ", aliases: ["สภาพ", "สถานะ"] },
  { key: "building", label: "ตึก/อาคาร", aliases: ["ตึก/อาคาร", "อาคาร", "ตึก"] },
  { key: "floor", label: "ชั้น", aliases: ["ชั้น"] },
  { key: "room", label: "ห้อง", aliases: ["ห้อง"] },
  { key: "locationLabel", label: "ระบุสถานที่ใช้งาน", aliases: ["ระบุสถานที่ใช้งาน", "สถานที่ใช้งาน", "สถานที่"] },
  { key: "holderName", label: "ผู้ถือครอง / ผู้รับผิดชอบ", aliases: ["ผู้ถือครอง", "ผู้รับผิดชอบ", "ผู้ดูแล", "ผู้ใช้งาน"] },
  { key: "category", label: "ประเภท", aliases: ["ประเภท", "ประเภท (FSN)", "หมวด"] },
  { key: "brand", label: "ยี่ห้อ", aliases: ["ยี่ห้อ"] },
  { key: "model", label: "รุ่น", aliases: ["รุ่น", "ยี่ห้อ/รุ่น"] },
  { key: "price", label: "ราคา", aliases: ["ราคา", "ราคาต่อหน่วย", "มูลค่าต้นทุนที่ได้มา", "มูลค่า"] },
  { key: "noteBroken", label: "หมายเหตุ: ใช้งานไม่ได้", aliases: ["ระบุสภาพครุภัณฑ์เฉพาะที่ใช้งานไม่ได้"] },
  { key: "noteMissing", label: "หมายเหตุ: สูญหาย/ไม่พบ", aliases: ["ระบุสภาพครุภัณฑ์เฉพาะที่สูญหาย", "หมายเหตุ"] }
];
// คงชื่อเดิมไว้ให้โค้ด/เทสต์ที่อ้าง COLUMNS
const COLUMNS = Object.fromEntries(FIELDS.map((f) => [f.key, f.aliases]));

const HEADER_TO_FIELD = new Map();
for (const f of FIELDS) {
  for (const n of f.aliases) HEADER_TO_FIELD.set(normalizeLabel(n), f.key);
}

const cell = (v) => (v === undefined || v === null ? "" : String(v).trim());
// ค่าที่ถือว่าว่าง (ไฟล์คณะใช้ "-" แทนช่องว่าง)
const blank = (v) => !v || /^[-–—]+$/.test(v);

// หาแถวหัวตาราง — ไฟล์จริงอาจมีชื่อเอกสาร/หัวกระดาษอยู่ข้างบนก่อน
//   แถวที่มีชื่อคอลัมน์ที่รู้จักมากที่สุด และต้องมีทั้งเลขครุภัณฑ์และชื่อ (หรือหัวที่ผู้ใช้เลือกไว้)
function findHeaderRow(grid, mapping) {
  const wanted = new Set(Object.values(mapping || {}).filter(Boolean).map(normalizeLabel));
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const cells = grid[i].map((h) => normalizeLabel(h));
    const fields = cells.map((h) => HEADER_TO_FIELD.get(h));
    const hasCode = fields.includes("assetCode") || (mapping?.assetCode && cells.includes(normalizeLabel(mapping.assetCode)));
    const hasName = fields.includes("name") || (mapping?.name && cells.includes(normalizeLabel(mapping.name)));
    if (!hasCode || !hasName) continue;
    const score = fields.filter(Boolean).length + cells.filter((h) => wanted.has(h)).length;
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  return best;
}

// เลือกคอลัมน์ของแต่ละช่อง: ที่ผู้ใช้เลือก > ชื่อที่ระบบรู้จัก (ถ้าเจอหลายคอลัมน์ เลือกคอลัมน์ที่มีข้อมูลมากที่สุด
// เช่น ไฟล์ปี 68 มี "รหัสสินทรัพย์อ้างอิง" ที่ว่างทั้งคอลัมน์ และเลขจริงอยู่ใน "Ref No. 1")
function resolveMapping(headers, dataRows, mapping = {}) {
  const filled = headers.map((_, c) => dataRows.reduce((n, r) => n + (blank(cell(r[c])) ? 0 : 1), 0));
  const colOf = {};
  for (const f of FIELDS) {
    if (Object.prototype.hasOwnProperty.call(mapping, f.key)) {
      const want = normalizeLabel(mapping[f.key]);
      const c = want ? headers.findIndex((h) => normalizeLabel(h) === want) : -1;
      colOf[f.key] = c; // "" = ผู้ใช้เลือก "ไม่มีในไฟล์"
      continue;
    }
    let best = -1;
    headers.forEach((h, c) => {
      if (HEADER_TO_FIELD.get(normalizeLabel(h)) === f.key && (best === -1 || filled[c] > filled[best])) best = c;
    });
    colOf[f.key] = best;
  }
  return colOf;
}

// อ่านไฟล์ Excel -> แถวที่แปลงเป็นรูปแบบเดียวกันแล้ว (ยังไม่แตะ DB — ทดสอบแยกได้)
//   opts.sheet   = ชื่อชีตที่จะอ่าน (ไม่ระบุ = ชีตแรกที่หาหัวตารางเจอ ข้ามชีตสรุป)
//   opts.mapping = { field: "ชื่อหัวคอลัมน์ในไฟล์" | "" } ที่ผู้ใช้เลือกเอง
function parseWorkbook(buffer, opts = {}) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const mapping = opts.mapping && typeof opts.mapping === "object" ? opts.mapping : {};
  const gridOf = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: false });

  let sheetName = null;
  let grid = null;
  let headerIdx = -1;
  const candidates = opts.sheet && wb.SheetNames.includes(opts.sheet) ? [opts.sheet] : wb.SheetNames;
  for (const name of candidates) {
    const g = gridOf(name);
    const idx = findHeaderRow(g, mapping);
    if (idx !== -1) {
      sheetName = name;
      grid = g;
      headerIdx = idx;
      break;
    }
  }
  if (headerIdx === -1) {
    const err = new Error(
      opts.sheet
        ? `ไม่พบหัวตารางในชีต "${opts.sheet}" — เลือกคอลัมน์เลขครุภัณฑ์และชื่อครุภัณฑ์ หรือเลือกชีตอื่น`
        : "ไม่พบหัวตาราง — ต้องมีคอลัมน์เลขครุภัณฑ์ (เช่น \"รหัสสินทรัพย์อ้างอิง\" หรือ \"Ref No. 1\") และ \"ชื่อสินทรัพย์\""
    );
    err.status = 400;
    err.sheets = wb.SheetNames;
    throw err;
  }

  const headers = grid[headerIdx].map(cell);
  const dataRows = grid.slice(headerIdx + 1);
  const colOf = resolveMapping(headers, dataRows, mapping);
  const usedCols = new Set(Object.values(colOf).filter((c) => c >= 0));
  const unknownColumns = headers.filter((h, i) => h && !usedCols.has(i));
  const val = (r, field) => {
    const c = colOf[field];
    const v = c >= 0 ? cell(r[c]) : "";
    return blank(v) ? "" : v;
  };

  const rows = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r.some((v) => cell(v))) continue; // ข้ามแถวว่าง

    const raw = {};
    headers.forEach((h, c) => {
      if (h) raw[h] = cell(r[c]);
    });
    const d = Object.fromEntries(FIELDS.map((f) => [f.key, val(r, f.key)]));
    const note = [d.noteBroken, d.noteMissing].filter(Boolean).join(" / ");

    const errors = [];
    if (!d.assetCode) errors.push("ไม่มีเลขครุภัณฑ์");
    if (!d.name) errors.push("ไม่มีชื่อสินทรัพย์");

    const parts = parseAssetCode(d.assetCode);
    const statusKey = statusFromLabel(d.status);
    const price = d.price ? Number(String(d.price).replace(/[,\s฿]/g, "")) : undefined;

    rows.push({
      row: i + 1, // เลขแถวตามที่เห็นใน Excel
      raw,
      errors,
      budgetAbbr: parts?.budgetAbbr || null,
      codeRecognized: !!parts,
      statusLabel: d.status || "",
      statusKey, // null = ไม่รู้จัก ต้องให้ Admin เลือก
      data: {
        assetCode: d.assetCode,
        name: d.name,
        brand: d.brand || undefined,
        model: d.model || undefined,
        category: d.category || undefined,
        holderName: d.holderName || undefined,
        note: note || undefined,
        price: Number.isFinite(price) ? price : undefined,
        location: {
          building: d.building || undefined,
          floor: d.floor || undefined,
          room: d.room || undefined,
          label: d.locationLabel || undefined
        }
      }
    });
  }

  const usedMapping = Object.fromEntries(FIELDS.map((f) => [f.key, colOf[f.key] >= 0 ? headers[colOf[f.key]] : ""]));
  return { sheets: wb.SheetNames, sheet: sheetName, headerRow: headerIdx + 1, headers, mapping: usedMapping, unknownColumns, rows };
}

module.exports = { parseWorkbook, COLUMNS, FIELDS };
