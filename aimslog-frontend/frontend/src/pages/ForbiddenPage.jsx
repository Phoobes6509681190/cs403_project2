import { Link } from 'react-router-dom'
import Icon from '../components/icon'
import { Card, Btn } from '../components/UI'

export default function ForbiddenPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <Card className="p-8 text-center max-w-sm">
        <span className="w-12 h-12 mx-auto rounded-full bg-badsoft text-bad grid place-items-center">
          <Icon name="shield" className="w-6 h-6" />
        </span>
        <h1 className="mt-4 text-lg font-bold">ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p className="mt-1 text-[13px] text-muted">บัญชีของคุณไม่มีสิทธิ์ใช้งานส่วนนี้ กรุณาติดต่อผู้ดูแลระบบหากคิดว่าเป็นข้อผิดพลาด</p>
        <Link to="/dashboard">
          <Btn variant="primary" className="mt-5">กลับหน้าแรก</Btn>
        </Link>
      </Card>
    </main>
  )
}
