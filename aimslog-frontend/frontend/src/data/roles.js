// สิทธิ์ 3 ระดับ — key ต้องตรงกับ backend/src/constants/roles.js
export const ROLES = {
  admin: { key: 'admin', label: 'ผู้ดูแลระบบ', hint: 'ทำได้ทุกอย่าง รวมถึงลบ ถังขยะ แต่งตั้งกรรมการ และจัดการผู้ใช้/สิทธิ์' },
  staff: { key: 'staff', label: 'เจ้าหน้าที่', hint: 'เพิ่ม/แก้ไข นำเข้า พิมพ์ QR ตรวจนับ (เมื่อเป็นกรรมการ) ปิดรอบ แต่ลบและแต่งตั้งกรรมการไม่ได้' },
  user: { key: 'user', label: 'ผู้ใช้ปกติ', hint: 'ดูข้อมูลและรายงานได้อย่างเดียว' },
}
export const ROLE_OPTIONS = Object.values(ROLES).map((r) => ({ value: r.key, label: `${r.label} — ${r.hint}` }))
export const roleLabel = (role) => ROLES[role]?.label || role
export const canEdit = (role) => role === 'admin' || role === 'staff'
export const canDelete = (role) => role === 'admin'
