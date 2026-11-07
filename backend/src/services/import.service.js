const XLSX = require("xlsx");
const { statusFromLabel, normalizeLabel } = require("../constants/status");
const { parseAssetCode } = require("../utils/assetCode");

// ชื่อคอลัมน์ที่รองรับ (ตามไฟล์จริงของคณะ + ชื่ออื่นที่พบบ่อย) — เทียบแบบตัดช่องว่างทิ้ง
const COLUMNS = {
  assetCode: ["รหัสสินทรัพย์อ้างอิง", "รหัสสินทรัพย์", "รหัสครุภัณฑ์", "เลขครุภัณฑ์", "หมายเลขครุภัณฑ์"],
  name: ["ชื่อสินทรัพย์", "ชื่อครุภัณฑ์", "รายการ"],
  brand: ["ยี่ห้อ"],
  model: ["รุ่น", "ยี่ห้อ/รุ่น"],
  category: ["ประเภท", "หมวด"],
  building: ["ตึก/อาคาร", "อาคาร", "ตึก"],
  floor: ["ชั้น"],
  room: ["ห้อง"],
  locationLabel: ["ระบุสถานที่ใช้งาน", "สถานที่ใช้งาน", "สถานที่"],
  status: ["สภาพ", "สถานะ"],
  holderName: ["ผู้ถือครอง", "ผู้รับผิดชอบ", "ผู้ดูแล", "ผู้ใช้งาน"],
  price: ["ราคา", "ราคาต่อหน่วย", "มูลค่า"]
};

const HEADER_TO_FIELD = new Map();
for (const [field, names] of Object.entries(COLUMNS)) {
  for (const n of names) HEADER_TO_FIELD.set(normalizeLabel(n), field);
}

const cell = (v) => (v === undefined || v === null ? "" : String(v).trim());

// อ่านไฟล์ Excel -> แถวที่แปลงเป็นรูปแบบเดียวกันแล้ว (ยังไม่แตะ DB — ทดสอบแยกได้)
function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

  // หาแถวหัวตาราง — ไฟล์จริงอาจมีชื่อเอกสาร/หัวกระดาษอยู่ข้างบนก่อน
  let headerIdx = -1;
  for (let i = 0; i < Math.min(grid.length, 20); i++) {
    const fields = grid[i].map((h) => HEADER_TO_FIELD.get(normalizeLabel(h)));
    if (fields.includes("assetCode") && fields.includes("name")) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) {
    const err = new Error("ไม่พบหัวตาราง — ต้องมีคอลัมน์ \"รหัสสินทรัพย์อ้างอิง\" และ \"ชื่อสินทรัพย์\" (ดู Template)");
    err.status = 400;
    throw err;
  }

  const headers = grid[headerIdx].map(cell);
  const fieldOf = headers.map((h) => HEADER_TO_FIELD.get(normalizeLabel(h)));
  const unknownColumns = headers.filter((h, i) => h && !fieldOf[i]);

  const rows = [];
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const r = grid[i];
    if (!r.some((v) => cell(v))) continue; // ข้ามแถวว่าง

    const raw = {};
    const d = {};
    headers.forEach((h, c) => {
      if (h) raw[h] = cell(r[c]);
      const f = fieldOf[c];
      if (f && d[f] === undefined) d[f] = cell(r[c]);
    });

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

  return { headerRow: headerIdx + 1, headers, unknownColumns, rows };
}

module.exports = { parseWorkbook, COLUMNS };
