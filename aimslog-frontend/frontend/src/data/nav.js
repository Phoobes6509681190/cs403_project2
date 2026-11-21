// roles: ใครมองเห็นเมนูนี้บ้าง — ใช้กรองใน Sidebar
// การกรองนี้เป็นแค่ระดับ UX (ซ่อนเมนูที่ไม่เกี่ยวข้อง) ตัวป้องกันจริงคือ
// RoleRoute ที่ block การเข้าถึงหน้าโดยตรง แม้ผู้ใช้จะพิมพ์ URL เองก็ตาม
export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid', path: '/dashboard', roles: ['admin', 'staff', 'user'] },
  { key: 'assets', label: 'ครุภัณฑ์', icon: 'box', path: '/assets', roles: ['admin', 'staff', 'user'] },
  { key: 'import', label: 'นำเข้า Excel', icon: 'upload', path: '/assets/import', roles: ['admin', 'staff'] },
  { key: 'inspection', label: 'ตรวจนับ', icon: 'check', path: '/inspection', roles: ['admin', 'staff', 'user'] },
  { key: 'committee', label: 'แต่งตั้งกรรมการ', icon: 'users', path: '/inspection/committee', roles: ['admin', 'staff'] },
  { key: 'reports', label: 'รายงาน', icon: 'file', path: '/reports', roles: ['admin', 'staff', 'user'] },
  { key: 'users', label: 'จัดการผู้ใช้', icon: 'shield', path: '/users', roles: ['admin'] },
  { key: 'activity', label: 'บันทึกกิจกรรม', icon: 'activity', path: '/activity', roles: ['admin'] },
  { key: 'loginLogs', label: 'ประวัติการเข้าใช้', icon: 'history', path: '/login-logs', roles: ['admin'] },
  { key: 'manual', label: 'คู่มือการใช้งาน', icon: 'book', path: '/manual', roles: ['admin', 'staff', 'user'] },
  { key: 'trash', label: 'ถังขยะ / สำรองข้อมูล', icon: 'trash', path: '/trash', roles: ['admin'] },
]
