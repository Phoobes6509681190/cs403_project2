import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { LoadingState } from './UI'

/**
 * Sprint 1: "ทำ Protected Route คือถ้าไม่ได้ Login จะเข้าหน้าอื่นไม่ได้"
 *
 * จุดสำคัญที่มักพลาดกันคือ:
 * 1. ต้องรอผลเช็ค session จาก backend ก่อน (status === 'loading') ไม่งั้นจะเกิด
 *    การ "วาบ" เนื้อหาที่ควรป้องกันออกมาแวบหนึ่งก่อนเด้งไป login (flash of protected content)
 * 2. เก็บ path เดิมไว้ผ่าน `state.from` เพื่อหลัง login เสร็จจะได้พาไปหน้าที่ตั้งใจจะเข้าแต่แรก
 * 3. Route guard นี้เป็นแค่เกราะป้องกันฝั่ง UI/UX เท่านั้น — ตัวป้องกันข้อมูลจริง
 *    ต้องอยู่ที่ backend (auth middleware ตรวจ cookie ทุก request) เสมอ เพราะโค้ด
 *    ฝั่ง frontend ใครก็เปิดดู/แก้ไขได้ผ่าน dev tools
 */
export default function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <LoadingState label="กำลังตรวจสอบสิทธิ์การเข้าใช้งาน..." />
  }

  if (status !== 'authenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
