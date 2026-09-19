// roles: ใครมองเห็นเมนูนี้บ้าง — ใช้กรองใน Sidebar
// การกรองนี้เป็นแค่ระดับ UX (ซ่อนเมนูที่ไม่เกี่ยวข้อง) ตัวป้องกันจริงคือ
// RoleRoute ที่ block การเข้าถึงหน้าโดยตรง แม้ผู้ใช้จะพิมพ์ URL เองก็ตาม
export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: 'grid', path: '/dashboard', roles: ['admin', 'user'] },
  { key: 'assets', label: 'ครุภัณฑ์', icon: 'box', path: '/assets', roles: ['admin', 'user'] },
  { key: 'import', label: 'นำเข้า Excel', icon: 'upload', path: '/assets/import', roles: ['admin'] },
  { key: 'inspection', label: 'ตรวจนับ', icon: 'check', path: '/inspection', roles: ['admin', 'user'] },
  { key: 'committee', label: 'แต่งตั้งกรรมการ', icon: 'users', path: '/inspection/committee', roles: ['admin'] },
  { key: 'reports', label: 'รายงาน', icon: 'file', path: '/reports', roles: ['admin', 'user'] },
]
