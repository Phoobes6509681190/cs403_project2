// เทียบแถวจากไฟล์ Excel กับข้อมูลเดิมในระบบ (ไม่แตะ DB — ทดสอบแยกได้)
const { STATUSES } = require("../constants/status");

// ฟิลด์ที่เทียบ — เลือกเฉพาะที่เปลี่ยนได้จริงในชีวิตของครุภัณฑ์
const COMPARE_FIELDS = [
  { key: "status", label: "สถานะ" },
  // สถานที่เทียบทีละช่อง (ตึก/ชั้น/ห้อง) และช่อง "ระบุสถานที่ใช้งาน" — แก้ช่องใดช่องหนึ่งก็ต้องเห็นว่าต่าง
  { key: "building", label: "ตึก/อาคาร" },
  { key: "floor", label: "ชั้น" },
  { key: "room", label: "ห้อง" },
  { key: "location", label: "สถานที่ใช้งาน" },
  { key: "holderName", label: "ผู้ถือครอง" },
  { key: "brand", label: "ยี่ห้อ" }
];

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const key = (code, name) => `${norm(code)}\u0000${norm(name)}`;

// ข้อความสถานที่ของแถวในไฟล์: ใช้ช่อง "ระบุสถานที่ใช้งาน" ก่อน ไม่มีก็ประกอบจาก อาคาร/ชั้น/ห้อง
function rowLocationLabel(loc = {}) {
  if (loc.label) return norm(loc.label);
  return norm([loc.building, loc.floor && `ชั้น ${loc.floor}`, loc.room && `ห้อง ${loc.room}`].filter(Boolean).join(" "));
}

const LOCATION_PARTS = ["building", "floor", "room"];

function currentValue(asset, field) {
  if (field === "location") return norm(asset.location?.label);
  if (LOCATION_PARTS.includes(field)) return norm(asset.location?.[field]);
  return norm(asset[field]);
}

function incomingValue(row, field, statusKey) {
  if (field === "status") return statusKey || "";
  if (field === "location") return rowLocationLabel(row.data.location);
  if (LOCATION_PARTS.includes(field)) return norm(row.data.location?.[field]);
  return norm(row.data[field]);
}

// คืนรายการฟิลด์ที่ต่างกัน — ช่องที่ "ว่างในไฟล์" ไม่นับว่าต่าง (ไฟล์ของคณะไม่มีช่องผู้ถือครอง)
function diffRow(asset, row, statusKey) {
  const diffs = [];
  for (const f of COMPARE_FIELDS) {
    const incoming = incomingValue(row, f.key, statusKey);
    if (!incoming) continue;
    const current = currentValue(asset, f.key);
    if (current !== incoming) {
      diffs.push({
        field: f.key,
        label: f.label,
        current,
        incoming,
        currentLabel: f.key === "status" ? STATUSES[current]?.label || current : current,
        incomingLabel: f.key === "status" ? STATUSES[incoming]?.label || incoming : incoming
      });
    }
  }
  return diffs;
}

// แบ่งแถวในไฟล์เป็น: ใหม่ / ตรงกัน / ต่างกัน / ข้อมูลไม่ครบ / ซ้ำในไฟล์ + รายการในระบบที่ไม่อยู่ในไฟล์
// resolveStatus(row) -> statusKey | null (null = ยังไม่รู้จัก รอ Admin เลือก)
function classify(rows, assets, resolveStatus) {
  const byKey = new Map();
  for (const a of assets) {
    const k = key(a.assetCode, a.name);
    if (!byKey.has(k)) byKey.set(k, a);
  }
  const seen = new Set();
  const out = { fresh: [], same: [], changed: [], invalid: [], dupInFile: [], matchedIds: new Set() };

  for (const r of rows) {
    if (r.errors.length) {
      out.invalid.push(r);
      continue;
    }
    const k = key(r.data.assetCode, r.data.name);
    if (seen.has(k)) {
      out.dupInFile.push(r);
      continue;
    }
    seen.add(k);
    const asset = byKey.get(k);
    if (!asset) {
      out.fresh.push(r);
      continue;
    }
    out.matchedIds.add(String(asset._id));
    const diffs = diffRow(asset, r, resolveStatus(r));
    (diffs.length ? out.changed : out.same).push({ row: r, asset, diffs });
  }

  // ในระบบแต่ไม่อยู่ในไฟล์ (ไม่นับที่ตัดโอนแล้ว เพราะคาดว่าไม่อยู่ในไฟล์ของคณะอยู่แล้ว)
  out.missing = assets.filter((a) => !out.matchedIds.has(String(a._id)) && a.status !== "transferred");
  return out;
}

module.exports = { COMPARE_FIELDS, LOCATION_PARTS, classify, diffRow, rowLocationLabel, key };
