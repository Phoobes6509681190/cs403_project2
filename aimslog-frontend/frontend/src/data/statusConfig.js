// สถานะครุภัณฑ์ 6 แบบ — key ต้องตรงกับ backend/src/constants/status.js
export const STATUS = {
  ok: { key: 'ok', label: 'ปกติ', dot: 'var(--ok)', cls: 'bg-oksoft text-ok' },
  broken: { key: 'broken', label: 'ชำรุด', hint: 'ซ่อมได้ แต่ยังไม่ได้ซ่อม', dot: 'var(--bad)', cls: 'bg-badsoft text-bad' },
  disposal: { key: 'disposal', label: 'รอจำหน่าย', hint: 'ชำรุด ซ่อมไม่ได้', dot: 'var(--bad)', cls: 'bg-badsoft text-bad ring-1 ring-inset ring-bad/40' },
  unneeded: { key: 'unneeded', label: 'หมดความจำเป็น', hint: 'หมดความจำเป็นในการใช้งาน', dot: 'var(--warn)', cls: 'bg-warnsoft text-warn' },
  transferred: { key: 'transferred', label: 'ตัดโอน', hint: 'โอนให้หน่วยงาน/สาขาอื่นแล้ว', dot: 'var(--brand)', cls: 'bg-brandsoft text-brand' },
  missing: { key: 'missing', label: 'ไม่พบพัสดุ', hint: 'ไม่พบพัสดุตามทะเบียน', dot: 'var(--gone)', cls: 'bg-gonesoft text-gone' },
}

export const STATUS_OPTIONS = Object.values(STATUS)
