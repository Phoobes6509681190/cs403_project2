import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Btn, Field, LoadingState, ErrorState, useToast } from '../components/UI'
import { getUsers } from '../services/userService'
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

          <Btn type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'กำลังสร้างรอบ...' : 'เริ่มรอบตรวจนับ'}
          </Btn>
        </form>
      </Card>
    </div>
  )
}
