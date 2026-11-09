import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Card, Btn, Field, Avatar, LoadingState, ErrorState, useToast } from '../components/UI'
import { getUsers } from '../services/userService'
import { createInspection, getActiveInspection } from '../services/inspectionService'
import { getReportSummary } from '../services/reportService'
import { useAuth } from '../hooks/useAuth'
import { nf } from '../utils/format'

const currentYear = new Date().getFullYear() + 543 // ปี พ.ศ.
const STEPS = ['ปีงบประมาณ', 'เลือกกรรมการ', 'ตรวจทานและเริ่มรอบ']

// เปิดรอบตรวจนับเป็น 3 ขั้นตอน — Admin เป็นผู้แต่งตั้ง ส่วนผู้บันทึกผลคือกรรมการที่ถูกเลือก
export default function CommitteePage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [users, setUsers] = useState([])
  const [active, setActive] = useState(null)
  const [itemCount, setItemCount] = useState(null)
  const [state, setState] = useState('loading')
  const [budgetYear, setBudgetYear] = useState(String(currentYear))
  const [selected, setSelected] = useState([])
  const [q, setQ] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setState('loading')
    try {
      const [u, a, s] = await Promise.all([getUsers({ active: 1 }), getActiveInspection(), getReportSummary()])
      setUsers(u.items || [])
      setActive(a)
      setItemCount(s.total)
      setState('ready')
    } catch {
      setState('error')
    }
  }
  useEffect(() => {
    load()
  }, [])

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return users.filter((u) => !n || [u.name, u.username, u.position].some((v) => v?.toLowerCase().includes(n)))
  }, [users, q])

  const toggle = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const chosen = users.filter((u) => selected.includes(u.id))
  const yearOk = /^25\d\d$/.test(budgetYear)

  const submit = async () => {
    setSubmitting(true)
    try {
      const data = await createInspection({ budgetYear, committee: selected.map((userId) => ({ userId })) })
      toast.success('เริ่มรอบตรวจนับแล้ว')
      navigate(`/inspection/${data.id}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'สร้างรอบตรวจนับไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดข้อมูลไม่สำเร็จ" />

  if (active) {
    return (
      <Card className="p-6 max-w-2xl space-y-3">
        <h2 className="font-semibold">มีรอบตรวจนับปี {active.budgetYear} เปิดอยู่</h2>
        <p className="text-[13px] text-muted">
          กรรมการ: {active.committee.map((c) => c.name).join(', ')} — ต้องปิดรอบเดิมก่อนจึงจะเริ่มรอบใหม่ได้
        </p>
        <Link to="/inspection"><Btn variant="primary">ไปที่รอบตรวจนับ</Btn></Link>
      </Card>
    )
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <ol className="flex gap-2 text-[12px]">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex-1 rounded-xl px-3 py-2 border ${i === step ? 'border-brand bg-brandsoft text-brandink font-medium' : i < step ? 'border-line text-ink' : 'border-line text-faint'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card className="p-5 space-y-4">
          <p className="text-[13px] text-muted">
            รอบนี้จะตรวจครุภัณฑ์ทั้งหมด {nf(itemCount)} ชิ้น (ไม่รวมที่ตัดโอนแล้ว)
          </p>
          <Field
            label="ปีงบประมาณ (พ.ศ.)"
            required
            value={budgetYear}
            error={budgetYear && !yearOk ? 'ใช้ปี พ.ศ. 4 หลัก เช่น 2569' : ''}
            onChange={(e) => setBudgetYear(e.target.value.trim())}
            className="max-w-[200px]"
          />
          <Btn variant="primary" disabled={!yearOk} onClick={() => setStep(1)}>ถัดไป</Btn>
        </Card>
      )}

      {step === 1 && (
        <Card className="p-5 space-y-3">
          <div className="rounded-xl bg-warnsoft text-warn text-[12px] px-3 py-2">
            มีเพียงกรรมการที่เลือกในขั้นนี้ที่บันทึกผลตรวจได้ — เจ้าหน้าที่พัสดุดูความคืบหน้าได้อย่างเดียว
            (คนจัดซื้อกับคนตรวจควรเป็นคนละคน) · ผู้ถือครองที่ผูกบัญชีไว้ยืนยันของตัวเองได้เสมอ
          </div>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาชื่อหรือตำแหน่ง"
            className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint"
          />
          <div className="border border-line rounded-xl divide-y divide-line max-h-80 overflow-y-auto">
            {shown.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface2">
                <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} className="w-4 h-4" />
                <Avatar user={u} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium">{u.name}</p>
                  <p className="text-[11px] text-faint">{u.position || `@${u.username}`}</p>
                </div>
                {u.role === 'admin' && <span className="text-[11px] text-warn">Admin</span>}
              </label>
            ))}
            {shown.length === 0 && <p className="px-4 py-6 text-center text-muted text-[13px]">ไม่พบรายชื่อ</p>}
          </div>
          <p className="text-[12px] text-muted">
            ไม่พบชื่อที่ต้องการ? เพิ่มบัญชีได้ที่ <Link to="/users" className="text-brand hover:underline">จัดการผู้ใช้</Link>
          </p>
          <div className="flex gap-2">
            <Btn onClick={() => setStep(0)}>ย้อนกลับ</Btn>
            <Btn variant="primary" disabled={!selected.length} onClick={() => setStep(2)}>ถัดไป ({selected.length} คน)</Btn>
          </div>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-5 space-y-4">
          <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-[13px]">
            <dt className="text-muted">ปีงบประมาณ</dt><dd className="font-medium">{budgetYear}</dd>
            <dt className="text-muted">จำนวนที่ต้องตรวจ</dt><dd className="font-medium">{nf(itemCount)} ชิ้น</dd>
            <dt className="text-muted">กรรมการ</dt>
            <dd className="space-y-1">
              {chosen.map((u) => (
                <div key={u.id} className="flex items-center gap-2">
                  <Avatar user={u} size={24} /> {u.name}
                  {u.id === me?.id && <span className="text-[11px] text-warn">(คุณ — ผู้แต่งตั้งเป็นกรรมการเองด้วย)</span>}
                </div>
              ))}
            </dd>
          </dl>
          <div className="flex gap-2">
            <Btn onClick={() => setStep(1)} disabled={submitting}>ย้อนกลับ</Btn>
            <Btn variant="primary" onClick={submit} disabled={submitting}>{submitting ? 'กำลังเริ่มรอบ...' : 'ยืนยันและเริ่มรอบตรวจนับ'}</Btn>
          </div>
        </Card>
      )}
    </div>
  )
}
