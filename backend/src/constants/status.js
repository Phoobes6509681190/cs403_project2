// สถานะครุภัณฑ์ 6 แบบ ตามที่ได้จากการสัมภาษณ์เจ้าหน้าที่พัสดุ
// key ภาษาอังกฤษใช้เก็บใน DB / ส่งระหว่าง API — label ภาษาไทยใช้แสดงผลและใช้จับคู่ตอน Import
const STATUSES = {
  ok: { label: "ปกติ", aliases: ["ปกติ", "ใช้งานได้", "ดี"] },
  broken: { label: "ชำรุด", aliases: ["ชำรุด", "ชำรุด (ซ่อมได้)", "รอซ่อม", "รอดำเนินการซ่อม"] },
  disposal: { label: "รอจำหน่าย", aliases: ["รอจำหน่าย", "ชำรุดซ่อมไม่ได้", "เสื่อมสภาพ"] },
  unneeded: { label: "หมดความจำเป็น", aliases: ["หมดความจำเป็น", "หมดความจำเป็นในการใช้งาน", "ไม่ได้ใช้งาน"] },
  transferred: { label: "ตัดโอน", aliases: ["ตัดโอน", "โอน", "โอนย้าย"] },
  missing: { label: "ไม่พบพัสดุ", aliases: ["ไม่พบ", "ไม่พบพัสดุ", "ไม่พบพัสดุในทะเบียน", "ไม่พบพัสดุตามทะเบียน", "ไม่พบครุภัณฑ์", "สูญหาย"] }
};

const STATUS_KEYS = Object.keys(STATUSES);

const normalize = (s) => String(s ?? "").replace(/\s+/g, "").trim();

const ALIAS_TO_KEY = new Map();
for (const [key, s] of Object.entries(STATUSES)) {
  for (const a of s.aliases) ALIAS_TO_KEY.set(normalize(a), key);
}

// แปลงข้อความสถานะจาก Excel เป็น key — คืน null ถ้าไม่รู้จัก (ให้ Admin เลือกเอง)
function statusFromLabel(label) {
  const n = normalize(label);
  if (!n) return "ok";
  if (STATUS_KEYS.includes(n)) return n;
  return ALIAS_TO_KEY.get(n) || null;
}

module.exports = { STATUSES, STATUS_KEYS, statusFromLabel, normalizeLabel: normalize };
