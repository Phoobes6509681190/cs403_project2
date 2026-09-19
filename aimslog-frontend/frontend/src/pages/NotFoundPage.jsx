import { Link } from 'react-router-dom'
import { Card, Btn } from '../components/UI'

export default function NotFoundPage() {
  return (
    <main className="min-h-screen grid place-items-center px-4">
      <Card className="p-8 text-center max-w-sm">
        <p className="text-4xl font-bold text-brand">404</p>
        <h1 className="mt-2 text-lg font-bold">ไม่พบหน้านี้</h1>
        <p className="mt-1 text-[13px] text-muted">ลิงก์อาจไม่ถูกต้อง หรือหน้านี้ถูกย้ายไปแล้ว</p>
        <Link to="/dashboard">
          <Btn variant="primary" className="mt-5">กลับหน้าแรก</Btn>
        </Link>
      </Card>
    </main>
  )
}
