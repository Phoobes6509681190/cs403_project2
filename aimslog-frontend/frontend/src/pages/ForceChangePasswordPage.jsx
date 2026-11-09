import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DeptLogo } from '../components/icon'
import { Card, Btn, Field, useToast } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { changePassword } from '../services/authService'

const MIN = 8

// บังคับเปลี่ยนรหัส: บัญชีที่ได้รหัสชั่วคราว (Admin สร้าง/ตั้งให้ หรือสคริปต์กู้รหัส)
// ต้องตั้งรหัสของตัวเองก่อนจึงจะใช้งานส่วนอื่นได้ — backend ก็ปิดกั้น API อื่นไว้เช่นกัน
export default function ForceChangePasswordPage() {
  const { user, updateUser, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const mismatch = form.confirm && form.next !== form.confirm
  const tooShort = form.next && form.next.length < MIN
  const same = form.next && form.next === form.current

  const submit = async (e) => {
    e.preventDefault()
    if (mismatch || tooShort || same) return
    setSaving(true)
    try {
      const { user: u } = await changePassword(form.current, form.next)
      updateUser(u)
      toast.success('ตั้งรหัสผ่านใหม่เรียบร้อยแล้ว')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      toast.error(err.response?.data?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="flex justify-center mb-5"><DeptLogo className="h-12" /></div>
        <h1 className="text-lg font-bold text-center">ตั้งรหัสผ่านใหม่ก่อนใช้งาน</h1>
        <p className="text-[13px] text-muted text-center mt-1 mb-5">
          บัญชี <b className="text-ink">{user?.username}</b> กำลังใช้รหัสผ่านชั่วคราว — กรุณาตั้งรหัสของคุณเอง
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Field label="รหัสผ่านชั่วคราว" type="password" required autoComplete="current-password" autoFocus
            value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <Field label="รหัสผ่านใหม่" type="password" required autoComplete="new-password"
            hint={`อย่างน้อย ${MIN} ตัวอักษร`}
            error={tooShort ? `อย่างน้อย ${MIN} ตัวอักษร` : same ? 'ต้องไม่ซ้ำกับรหัสชั่วคราว' : ''}
            value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <Field label="ยืนยันรหัสผ่านใหม่" type="password" required autoComplete="new-password"
            error={mismatch ? 'รหัสผ่านไม่ตรงกัน' : ''}
            value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          <Btn type="submit" variant="primary" className="w-full justify-center" disabled={saving || mismatch || tooShort || same}>
            {saving ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านและเข้าใช้งาน'}
          </Btn>
        </form>
        <button onClick={logout} className="mt-4 w-full text-center text-[12px] text-muted hover:text-ink">ออกจากระบบ</button>
      </Card>
    </div>
  )
}
