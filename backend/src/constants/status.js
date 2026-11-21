// สถานะครุภัณฑ์ ตามที่ได้จากการสัมภาษณ์เจ้าหน้าที่พัสดุ + ค่าในไฟล์คณะปี 68
//   counted: false = ไม่นับในยอดของสาขาและไม่เข้ารอบตรวจนับ (ตัดโอน + สถานะปัญหาข้อมูล 3 แบบ)
// key ภาษาอังกฤษใช้เก็บใน DB / ส่งระหว่าง API — label ภาษาไทยใช้แสดงผลและใช้จับคู่ตอน Import
const STATUSES = {
  ok: { label: "ปกติ", aliases: ["ปกติ", "ใช้งานได้", "ดี"] },
  broken: { label: "ชำรุด", aliases: ["ชำรุด", "ชำรุด (ซ่อมได้)", "รอซ่อม", "รอดำเนินการซ่อม"] },
  disposal: { label: "รอจำหน่าย", aliases: ["รอจำหน่าย", "ชำรุดซ่อมไม่ได้"] },
  // ไฟล์คณะใช้ "เสื่อมสภาพ" ในความหมายหมดความจำเป็นในการใช้งาน (ยืนยันกับเจ้าหน้าที่แล้ว)
  unneeded: { label: "หมดความจำเป็น", aliases: ["หมดความจำเป็น", "หมดความจำเป็นในการใช้งาน", "ไม่ได้ใช้งาน", "เสื่อมสภาพ"] },
  transferred: { label: "ตัดโอน", counted: false, aliases: ["ตัดโอน", "โอน", "โอนย้าย", "จำหน่ายแล้ว"] },
  missing: { label: "ไม่พบพัสดุ", aliases: ["ไม่พบ", "หาไม่พบ", "ไม่พบพัสดุ", "ไม่พบพัสดุในทะเบียน", "ไม่พบพัสดุตามทะเบียน", "ไม่พบครุภัณฑ์", "สูญหาย"] },
  // ปัญหาของข้อมูล (ไม่ใช่สภาพของของ) — เก็บตามที่ไฟล์ระบุไว้ ไม่แปลงเป็นสถานะอื่น
  duplicate: { label: "ข้อมูลซ้ำ", counted: false, aliases: ["ข้อมูลซ้ำ"] },
  dataerror: { label: "ข้อมูลบางส่วนผิด", counted: false, aliases: ["ข้อมูลบางส่วนผิด"] },
  notours: { label: "ไม่ใช่ครุภัณฑ์หน่วยงาน", counted: false, aliases: ["ไม่ใช่ครุภัณฑ์หน่วยงาน", "ไม่ใช่ครุภัณฑ์ของหน่วยงาน"] }
};

const STATUS_KEYS = Object.keys(STATUSES);
// ไม่นับในยอดของสาขา / ไม่เข้ารอบตรวจนับ
const NOT_COUNTED = STATUS_KEYS.filter((k) => STATUSES[k].counted === false);
const DATA_ISSUE = ["duplicate", "dataerror", "notours"];

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

module.exports = { STATUSES, STATUS_KEYS, NOT_COUNTED, DATA_ISSUE, statusFromLabel, normalizeLabel: normalize };
