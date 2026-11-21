// สิทธิ์ 3 ระดับ — key ต้องตรงกับ backend/src/constants/roles.js
export const ROLES = {
  admin: { key: 'admin', label: 'ผู้ดูแลระบบ', hint: 'ทำได้ทุกอย่าง รวมถึงลบ ถังขยะ และจัดการผู้ใช้/สิทธิ์' },
  staff: { key: 'staff', label: 'ผู้ใช้', hint: 'เพิ่ม/แก้ไข นำเข้า พิมพ์ QR เปิด-ปิดรอบตรวจนับ แต่ลบไม่ได้' },
  user: { key: 'user', label: 'ผู้ดูข้อมูล', hint: 'ดูอย่างเดียว ตรวจของที่ตนถือครอง หรือเมื่อได้เป็นกรรมการ' },
}
export const ROLE_OPTIONS = Object.values(ROLES).map((r) => ({ value: r.key, label: `${r.label} — ${r.hint}` }))
export const roleLabel = (role) => ROLES[role]?.label || role
export const canEdit = (role) => role === 'admin' || role === 'staff'
export const canDelete = (role) => role === 'admin'
