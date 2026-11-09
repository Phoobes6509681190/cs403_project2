import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Btn, Field, SelectField, LoadingState, ErrorState, useToast } from '../components/UI'
import { getUsers, createUser } from '../services/userService'
import { createInspection } from '../services/inspectionService'

const currentYear = new Date().getFullYear() + 543 // ปี พ.ศ.

export default function CommitteePage() {
  const toast = useToast()
  const navigate = useNavigate()

  const [users, setUsers] = useState([])
  const [state, setState] = useState('loading')
  const [budgetYear, setBudgetYear] = useState(String(currentYear))
  const [selected, setSelected] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const emptyUser = { username: '', name: '', password: '', role: 'user' }
  const [newUser, setNewUser] = useState(emptyUser)
  const [creating, setCreating] = useState(false)

  const addUser = async (e) => {
    e.preventDefault()
    setCreating(true)
    try {
      const u = await createUser(newUser)
      setUsers((prev) => [...prev, u])
      setSelected((prev) => [...prev, u.id])
      setNewUser(emptyUser)
      toast.success(`เพิ่มผู้ใช้ ${u.name} แล้ว`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'เพิ่มผู้ใช้ไม่สำเร็จ')
    } finally {
      setCreating(false)
    }
  }

  const load = async () => {
    setState('loading')
    try {
      const data = await getUsers()
      setUsers(data.items || [])
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const toggle = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const submit = async (e) => {
    e.preventDefault()
    if (selected.length === 0) {
      toast.error('เลือกกรรมการอย่างน้อย 1 คน')
      return
    }
    setSubmitting(true)
    try {
      const committee = selected.map((userId) => ({ userId, role: 'committee' }))
      const data = await createInspection({ budgetYear, committee })
      toast.success('สร้างรอบตรวจนับใหม่เรียบร้อยแล้ว')
      navigate(`/inspection/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'สร้างรอบตรวจนับไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดรายชื่อผู้ใช้ไม่สำเร็จ" />

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="p-5">
        <h2 className="font-semibold mb-1">แต่งตั้งกรรมการตรวจนับครุภัณฑ์</h2>
        <p className="text-[12px] text-muted mb-4">เลือกปีงบประมาณและรายชื่อกรรมการที่จะได้รับสิทธิ์บันทึกผลตรวจนับในรอบนี้</p>

        <form onSubmit={submit} className="space-y-4">
          <Field
            label="ปีงบประมาณ (พ.ศ.)"
            required
            value={budgetYear}
            onChange={(e) => setBudgetYear(e.target.value)}
            className="max-w-[200px]"
          />

          <div>
            <p className="text-[13px] text-muted mb-2">กรรมการ ({selected.length} คน)</p>
            <div className="border border-line rounded-xl divide-y divide-line max-h-80 overflow-y-auto">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface2">
                  <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="w-4 h-4" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">{u.name || u.username}</p>
                    <p className="text-[11px] text-faint">{u.username}</p>
                  </div>
                </label>
              ))}
              {users.length === 0 && <p className="px-4 py-6 text-center text-muted text-[13px]">ไม่พบรายชื่อผู้ใช้</p>}
            </div>
          </div>

          <p className="text-[12px] text-muted">
            เมื่อเริ่มรอบ ระบบจะดึงครุภัณฑ์ทุกชิ้น (ยกเว้นที่ตัดโอนแล้ว) มาเป็นรายการตรวจ
            ผู้ถือครองที่ผูกบัญชีไว้จะยืนยันสภาพของตัวเองได้ด้วย
          </p>
          <Btn type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'กำลังสร้างรอบ...' : 'เริ่มรอบตรวจนับ'}
          </Btn>
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-1">เพิ่มผู้ใช้ใหม่</h3>
        <p className="text-[12px] text-muted mb-4">กรรมการหรือบุคลากรที่ยังไม่มีบัญชี — เพิ่มแล้วจะถูกเลือกเป็นกรรมการให้อัตโนมัติ</p>
        <form onSubmit={addUser} className="grid sm:grid-cols-2 gap-3">
          <Field label="ชื่อ-สกุล" required value={newUser.name} onChange={(e) => setNewUser({ ...newUser, name: e.target.value })} />
          <Field label="ชื่อผู้ใช้ (ใช้ login)" required value={newUser.username} onChange={(e) => setNewUser({ ...newUser, username: e.target.value })} />
          <Field label="รหัสผ่านเริ่มต้น" type="password" required minLength={8} value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} />
          <SelectField
            label="สิทธิ์"
            value={newUser.role}
            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
            options={[{ value: 'user', label: 'ผู้ใช้ทั่วไป' }, { value: 'admin', label: 'เจ้าหน้าที่พัสดุ (Admin)' }]}
          />
          <div className="sm:col-span-2">
            <Btn type="submit" disabled={creating}>{creating ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}</Btn>
          </div>
        </form>
      </Card>
    </div>
  )
}
