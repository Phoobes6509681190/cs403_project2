import { useEffect, useState } from 'react'
import { Card, Btn, Field, SelectField, useToast } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { changePassword } from '../services/authService'
import { getUsers, resetUserPassword } from '../services/userService'

const MIN = 8

export default function AccountPage() {
  const { user, role } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const mismatch = form.confirm && form.next !== form.confirm
  const tooShort = form.next && form.next.length < MIN

  const submit = async (e) => {
    e.preventDefault()
    if (mismatch || tooShort) return
    setSaving(true)
    try {
      await changePassword(form.current, form.next)
      toast.success('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว')
      setForm({ current: '', next: '', confirm: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  // ส่วนของ Admin: ตั้งรหัสใหม่ให้ผู้ใช้คนอื่น
  const [users, setUsers] = useState([])
  const [reset, setReset] = useState({ userId: '', password: '' })
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    if (role === 'admin') getUsers().then((d) => setUsers(d.items || [])).catch(() => {})
  }, [role])

  const submitReset = async (e) => {
    e.preventDefault()
    setResetting(true)
    try {
      await resetUserPassword(reset.userId, reset.password)
      const u = users.find((x) => x.id === reset.userId)
      toast.success(`ตั้งรหัสผ่านใหม่ให้ ${u?.name || u?.username} แล้ว`)
      setReset({ userId: '', password: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'ตั้งรหัสผ่านไม่สำเร็จ')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card className="p-5">
        <h2 className="font-semibold mb-1">เปลี่ยนรหัสผ่าน</h2>
        <p className="text-[12px] text-muted mb-4">
          บัญชี {user?.name} ({user?.username}) · รหัสผ่านใหม่อย่างน้อย {MIN} ตัวอักษร
        </p>
        <form onSubmit={submit} className="space-y-3">
          <Field label="รหัสผ่านเดิม" type="password" required autoComplete="current-password"
            value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <Field label="รหัสผ่านใหม่" type="password" required autoComplete="new-password"
            error={tooShort ? `อย่างน้อย ${MIN} ตัวอักษร` : ''}
            value={form.next} onChange={(e) => setForm({ ...form, next: e.target.value })} />
          <Field label="ยืนยันรหัสผ่านใหม่" type="password" required autoComplete="new-password"
            error={mismatch ? 'รหัสผ่านไม่ตรงกัน' : ''}
            value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
          <Btn type="submit" variant="primary" disabled={saving || mismatch || tooShort}>
            {saving ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
          </Btn>
        </form>
      </Card>

      {role === 'admin' && (
        <Card className="p-5">
          <h2 className="font-semibold mb-1">ตั้งรหัสผ่านใหม่ให้ผู้ใช้</h2>
          <p className="text-[12px] text-muted mb-4">ใช้เมื่อผู้ใช้ลืมรหัสผ่าน — แจ้งรหัสใหม่ให้ผู้ใช้แล้วให้เขาเปลี่ยนเองอีกครั้ง</p>
          <form onSubmit={submitReset} className="space-y-3">
            <SelectField
              label="ผู้ใช้"
              required
              value={reset.userId}
              onChange={(e) => setReset({ ...reset, userId: e.target.value })}
              options={[
                { value: '', label: '— เลือกผู้ใช้ —' },
                ...users.filter((u) => u.id !== user?.id).map((u) => ({ value: u.id, label: `${u.name} (${u.username})` })),
              ]}
            />
            <Field label="รหัสผ่านใหม่" type="text" required minLength={MIN} autoComplete="off"
              value={reset.password} onChange={(e) => setReset({ ...reset, password: e.target.value })} />
            <Btn type="submit" disabled={resetting || !reset.userId || reset.password.length < MIN}>
              {resetting ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
            </Btn>
          </form>
        </Card>
      )}
    </div>
  )
}
