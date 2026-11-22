export const TITLES = {
  dashboard: 'ภาพรวมครุภัณฑ์',
  assets: 'ครุภัณฑ์',
  assetDetail: 'รายละเอียดครุภัณฑ์',
  import: 'นำเข้าข้อมูลจาก Excel',
  labels: 'พิมพ์ QR Code',
  inspection: 'ตรวจนับครุภัณฑ์',
  committee: 'แต่งตั้งกรรมการตรวจนับ',  // เปิดจากหน้าตรวจนับ (ไม่มีเมนูแยก)
  reports: 'รายงาน',
  profile: 'โปรไฟล์',
  users: 'จัดการผู้ใช้',
  trash: 'ถังขยะและสำรองข้อมูล',
  'login-logs': 'ประวัติการเข้าสู่ระบบ',
  activity: 'บันทึกกิจกรรม',
  manual: 'คู่มือการใช้งาน',
}

// หาชื่อหน้าจาก URL — ดูจากส่วนท้ายของ path ก่อน (เจาะจงที่สุด)
// เช่น /inspection/committee = แต่งตั้งกรรมการ (ไม่ใช่ ตรวจนับ), /assets/import = นำเข้า, /assets/<id> = รายละเอียด
export function titleOf(pathname) {
  const parts = pathname.split('/').filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (TITLES[parts[i]]) {
      if (parts[i] === 'assets' && i < parts.length - 1) return TITLES.assetDetail
      return TITLES[parts[i]]
    }
  }
  return 'AIMSlog'
}
