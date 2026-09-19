import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ใช้ครอบ route ที่ต้องจำกัดสิทธิ์เฉพาะ role (เช่นนำเข้า Excel, แต่งตั้งกรรมการ
// ควรทำได้เฉพาะ Admin) ต้องอยู่ "ข้างใน" ProtectedRoute เสมอ (สมมติว่าล็อกอินแล้ว)
//
// ย้ำอีกครั้ง: role ที่เห็นในนี้มาจาก /api/auth/me ซึ่ง backend เป็นคนกำหนด
// ไม่ใช่ frontend เชื่อ role จาก token เอง — ป้องกันคนแก้ role ใน devtools แล้วหลอกตัวเอง
// (การกดผ่านหน้านี้ได้ไม่ได้แปลว่า API เบื้องหลังจะยอมให้ทำจริง ถ้า backend เช็ค role ซ้ำ)
export default function RoleRoute({ allow = [] }) {
  const { role } = useAuth()

  if (!allow.includes(role)) {
    return <Navigate to="/403" replace />
  }

  return <Outlet />
}
