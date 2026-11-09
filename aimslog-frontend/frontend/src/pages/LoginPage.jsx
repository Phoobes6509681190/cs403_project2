import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DeptLogo } from '../components/icon'
import { Card, Btn, Field } from '../components/UI'
import { useAuth } from '../hooks/useAuth'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [forgotOpen, setForgotOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfaToken, setMfaToken] = useState('') // มีค่า = อยู่ขั้นยืนยันรหัส 6 หลัก
  const [code, setCode] = useState('')
  const { login, completeMfa } = useAuth()
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
      const r = await login(username.trim(), password)
      if (r.mfaRequired) {
        setMfaToken(r.mfaToken)
        setPassword('')
        return
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      // ไม่บอกรายละเอียดว่า "ไม่พบชื่อผู้ใช้" หรือ "รหัสผ่านผิด" แยกกัน
      // เพื่อกัน user enumeration (คนร้ายไล่เดาว่า username ไหนมีอยู่จริงในระบบ)
      const status = err.response?.status
      if (status === 401) {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      } else if (status === 429) {
        // ข้อความจาก server บอกเวลาที่ต้องรอ (บัญชีถูกล็อก / IP ถูกจำกัด)
        setError(err.response?.data?.message || 'พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่')
      } else {
        setError('เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')
      }
    } finally {
      setLoading(false)
    }
  }

  const submitMfa = async (e) => {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await completeMfa(mfaToken, code.trim())
      if (r.backupCodesLeft !== undefined && r.backupCodesLeft <= 2) {
        window.alert(`ใช้รหัสสำรองแล้ว เหลืออีก ${r.backupCodesLeft} ชุด — สร้างชุดใหม่ได้ที่ โปรไฟล์ → ความปลอดภัย`)
      }
      navigate(redirectTo, { replace: true })
    } catch (err) {
      const status = err.response?.status
      if (status === 401 && /หมดเวลา/.test(err.response?.data?.message || '')) {
        setMfaToken('')
        setCode('')
      }
      setError(err.response?.data?.message || 'ยืนยันไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  if (mfaToken) {
    return (
      <main className="min-h-screen grid place-items-center px-4 py-10">
        <Card className="w-full max-w-sm p-7">
          <div className="flex flex-col items-center text-center">
            <DeptLogo className="h-14" />
            <h1 className="mt-3 text-lg font-bold">ยืนยันตัวตน 2 ขั้นตอน</h1>
            <p className="text-[12px] text-muted mt-1">กรอกรหัส 6 หลักจากแอป Authenticator หรือรหัสสำรอง</p>
          </div>
          <form className="mt-6 space-y-4" onSubmit={submitMfa} noValidate>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              aria-label="รหัสยืนยัน 6 หลัก"
              className="w-full text-center tracking-[0.5em] font-mono text-2xl rounded-2xl border border-line bg-surface px-3 py-3 focus:border-brand"
            />
            {error && <p className="text-[12px] text-bad bg-badsoft rounded-lg px-3 py-2">{error}</p>}
            <Btn type="submit" variant="primary" className="w-full justify-center py-2.5" disabled={loading || !code.trim()}>
              {loading ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
            </Btn>
          </form>
          <button
            type="button"
            onClick={() => { setMfaToken(''); setCode(''); setError('') }}
            className="mt-3 w-full text-center text-[12px] text-muted hover:text-ink"
          >
            ← กลับไปหน้าเข้าสู่ระบบ
          </button>
        </Card>
      </main>
    )
  }

  return (
    <main className="min-h-screen grid place-items-center px-4 py-10">
      <Card className="w-full max-w-sm p-7">
        <div className="flex flex-col items-center text-center">
          <DeptLogo className="h-14" />
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

        <div className="mt-3 text-center">
          <button type="button" onClick={() => setForgotOpen((v) => !v)} className="text-[12px] text-brand hover:underline">
            ลืมรหัสผ่าน?
          </button>
        </div>
        {forgotOpen && (
          <div className="mt-3 rounded-2xl bg-surface2 px-4 py-3 text-[12px] text-muted leading-relaxed space-y-1.5">
            <p>
              <b className="text-ink">บุคลากร / กรรมการ:</b> ติดต่อเจ้าหน้าที่พัสดุ (Admin) ให้ตั้งรหัสชั่วคราวให้
              แล้ว login ด้วยรหัสนั้น — ระบบจะให้ตั้งรหัสใหม่ของคุณเองทันที
            </p>
            <p>
              <b className="text-ink">เจ้าหน้าที่พัสดุ (Admin):</b> ให้ Admin อีกคนตั้งรหัสให้ที่เมนู "จัดการผู้ใช้"
              หรือติดต่อผู้ดูแลระบบให้ใช้สคริปต์กู้รหัส
            </p>
          </div>
        )}

      </Card>
    </main>
  )
}
