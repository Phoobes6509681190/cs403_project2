// สถานะครุภัณฑ์ — key ต้องตรงกับ backend/src/constants/status.js
// counted: false = ไม่นับในยอดของสาขา (ตัดโอน + ปัญหาข้อมูล 3 แบบจากไฟล์คณะ)
export const STATUS = {
  ok: { key: 'ok', label: 'ปกติ', dot: 'var(--ok)', cls: 'bg-oksoft text-ok' },
  broken: { key: 'broken', label: 'ชำรุด', hint: 'เสียหาย ใช้งานไม่ได้ตามปกติ', dot: 'var(--bad)', cls: 'bg-badsoft text-bad' },
  unneeded: { key: 'unneeded', label: 'เสื่อมสภาพ', hint: 'หมดความจำเป็นในการใช้งาน', dot: 'var(--warn)', cls: 'bg-warnsoft text-warn' },
  transferred: { key: 'transferred', label: 'จำหน่ายแล้ว', counted: false, hint: 'โอนให้หน่วยงาน/สาขาอื่น หรือจำหน่ายแล้ว', dot: 'var(--moved)', cls: 'text-[color:var(--moved)]' },
  missing: { key: 'missing', label: 'หาไม่พบ', hint: 'ไม่พบพัสดุตามทะเบียน', dot: 'var(--gone)', cls: 'bg-gonesoft text-gone' },
  // ปัญหาของข้อมูล — แสดงตามที่ไฟล์คณะระบุ ไม่นับในยอดของสาขา
  duplicate: { key: 'duplicate', label: 'ข้อมูลซ้ำ', counted: false, hint: 'รายการซ้ำกับรายการอื่นในทะเบียน', dot: 'var(--faint)', cls: 'text-muted' },
  dataerror: { key: 'dataerror', label: 'ข้อมูลบางส่วนผิด', counted: false, hint: 'ต้องตรวจสอบ/แก้ไขข้อมูล', dot: 'var(--faint)', cls: 'text-muted' },
  notours: { key: 'notours', label: 'ไม่ใช่ครุภัณฑ์หน่วยงาน', counted: false, hint: 'ไม่ใช่ทรัพย์สินของสาขา', dot: 'var(--faint)', cls: 'text-muted' },
}

export const STATUS_OPTIONS = Object.values(STATUS)
// ปัญหาข้อมูลจากไฟล์คณะ — นับให้เห็นบนหน้าจอ แต่ไม่ออกในรายงานที่พิมพ์
export const DATA_ISSUE = ['duplicate', 'dataerror', 'notours']
