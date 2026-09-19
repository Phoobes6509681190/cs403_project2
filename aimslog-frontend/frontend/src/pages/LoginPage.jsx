import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Logo } from '../components/icon'
import { Card, Btn, Field } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const redirectTo = location.state?.from?.pathname || '/dashboard'

  const submit = async (e) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('กรอกชื่อผู้ใช้และรหัสผ่านให้ครบก่อนเข้าสู่ระบบ')
      return
    }

    setLoading(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate(redirectTo, { replace: true })
    } catch (err) {
      // ไม่บอกรายละเอียดว่า "ไม่พบชื่อผู้ใช้" หรือ "รหัสผ่านผิด" แยกกัน
      // เพื่อกัน user enumeration (คนร้ายไล่เดาว่า username ไหนมีอยู่จริงในระบบ)
      const status = err.response?.status
      if (status === 401) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      } else if (status === 429) {
        setError('พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่')
      } else {
        setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <Card className="w-full max-w-sm p-7">
        <div className="flex flex-col items-center text-center">
          <Logo className="w-12 h-12" />
          <h1 className="mt-3 text-xl font-bold">AIMSlog</h1>
          <p className="text-[12px] text-muted">ระบบจัดการครุภัณฑ์ สาขาวิทยาการคอมพิวเตอร์</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <Field
            label="ชื่อผู้ใช้"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
          />
          <Field
            label="รหัสผ่าน"
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && <p className="text-[12px] text-bad bg-badsoft rounded-lg px-3 py-2">{error}</p>}

          <Btn type="submit" variant="primary" className="w-full justify-center py-2.5" disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </Btn>
        </form>

        <p className="mt-6 pt-5 border-t border-line text-center text-[11px] text-faint leading-relaxed">
          เข้าใช้ได้เฉพาะบุคลากรสาขาวิทยาการคอมพิวเตอร์
          <br />
          มหาวิทยาลัยธรรมศาสตร์ · การเข้าใช้งานทั้งหมดถูกบันทึกไว้
        </p>
      </Card>
    </main>
  )
}
