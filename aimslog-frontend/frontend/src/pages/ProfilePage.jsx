import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/icon'
import { Card, Btn, Field, Avatar, RolePill, StatusPill, EmptyState, useToast } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { QRCodeSVG } from 'qrcode.react'
import { updateProfile, changePassword, mfaSetup, mfaEnable, mfaDisable, mfaNewBackupCodes } from '../services/authService'
import { getAssets } from '../services/assetService'
import { nf } from '../utils/format'

const MIN = 8

// ย่อรูปเป็นสี่เหลี่ยมจัตุรัส 256px (JPEG) ก่อนส่ง — เก็บใน DB ได้โดยไม่ต้องมีที่เก็บไฟล์
function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(img.src)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function ProfilePage() {
  const { user, role, updateUser } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'assets')
  const fileRef = useRef(null)

  const [assets, setAssets] = useState({ items: [], total: 0 })
  useEffect(() => {
    getAssets({ holderUser: 'me', perPage: 100 }).then(setAssets).catch(() => {})
  }, [])

  const save = async (patch, msg = 'บันทึกโปรไฟล์แล้ว') => {
    const { user: u } = await updateProfile(patch)
    updateUser(u)
    toast.success(msg)
  }

  const onPickAvatar = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) return toast.error('เลือกไฟล์รูปภาพ')
    try {
      await save({ avatar: await resizeImage(f) }, 'เปลี่ยนรูปโปรไฟล์แล้ว')
    } catch (err) {
      toast.error(err.response?.data?.message || 'อัปโหลดรูปไม่สำเร็จ')
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {/* ส่วนหัวแบบหน้าโปรไฟล์ social media: ภาพปก + รูปโปรไฟล์ + ชื่อ */}
      <Card className="overflow-hidden">
        <div className="h-28 sm:h-36 bg-gradient-to-r from-[#f7a823] via-[#f39021] to-[#e8731c]" />
        <div className="px-5 pb-5">
          <div className="flex flex-wrap items-end gap-4 -mt-12">
            <div className="relative">
              <Avatar user={user} size={104} className="ring-4 ring-[var(--surface)]" />
              <button
                onClick={() => fileRef.current?.click()}
                title="เปลี่ยนรูปโปรไฟล์"
                className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-surface border border-line grid place-items-center hover:bg-surface2"
              >
                <Icon name="camera" />
              </button>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onPickAvatar} />
            </div>
            <div className="min-w-0 flex-1 pt-14 sm:pt-0">
              <h2 className="text-xl font-bold leading-tight">{user?.name}</h2>
              <p className="text-[13px] text-muted">@{user?.username}{user?.position ? ` · ${user.position}` : ''}</p>
            </div>
            <RolePill role={role} />
          </div>
          {user?.bio && <p className="mt-3 text-[13px]">{user.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
            {user?.email && <span>อีเมล: {user.email}</span>}
            {user?.phone && <span>โทร: {user.phone}</span>}
            <span>ถือครองครุภัณฑ์ {nf(assets.total)} ชิ้น</span>
          </div>
        </div>
        <div className="flex border-t border-line text-[13px]">
          {[
            ['assets', 'ครุภัณฑ์ที่ถือครอง'],
            ['edit', 'แก้ไขโปรไฟล์'],
            ['security', 'ความปลอดภัย'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-3 font-medium border-b-2 ${tab === k ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'assets' && (
        <Card className="p-4">
          {assets.items.length === 0 ? (
            <EmptyState message="ยังไม่มีครุภัณฑ์ที่ผูกกับบัญชีของคุณ — ให้เจ้าหน้าที่พัสดุผูกบัญชีผู้ถือครองในหน้าแก้ไขครุภัณฑ์" />
          ) : (
            <ul className="divide-y divide-line">
              {assets.items.map((a) => (
                <li key={a.id} className="py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <Link to={`/assets/${a.id}`} className="font-medium text-[13px] hover:text-brand">{a.name}</Link>
                    <p className="text-[11px] text-faint">{a.code} · {a.room || 'ไม่ระบุสถานที่'}</p>
                  </div>
                  <StatusPill status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'edit' && <EditProfile user={user} onSave={save} onRemoveAvatar={() => save({ avatar: '' }, 'ลบรูปโปรไฟล์แล้ว')} />}
      {tab === 'security' && (
        <>
          <MfaCard user={user} onChange={updateUser} />
          <PasswordForm />
        </>
      )}
    </div>
  )
}

function EditProfile({ user, onSave, onRemoveAvatar }) {
  const toast = useToast()
  const [f, setF] = useState({
    name: user?.name || '', position: user?.position || '', email: user?.email || '', phone: user?.phone || '', bio: user?.bio || '',
  })
  const [saving, setSaving] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(f)
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
        <Field label="ชื่อที่แสดง" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field label="ตำแหน่ง" placeholder="เช่น เจ้าหน้าที่พัสดุ, อาจารย์" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
        <Field label="อีเมล" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field label="เบอร์โทร / เบอร์ภายใน" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <label className="block sm:col-span-2">
          <span className="text-[13px] text-muted">แนะนำตัว</span>
          <textarea
            rows={3}
            maxLength={300}
            value={f.bio}
            onChange={(e) => setF({ ...f, bio: e.target.value })}
            placeholder="เช่น ห้องทำงาน บร.2 ห้อง 210 · ติดต่อเรื่องครุภัณฑ์ได้ในเวลาราชการ"
            className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-faint focus:border-brand"
          />
          <span className="text-[11px] text-faint">{f.bio.length}/300</span>
        </label>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Btn type="submit" variant="primary" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Btn>
          {user?.avatar && <Btn type="button" onClick={onRemoveAvatar}>ลบรูปโปรไฟล์</Btn>}
        </div>
      </form>
    </Card>
  )
}

function PasswordForm() {
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

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-3 max-w-md">
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
  )
}

// ยืนยัน 2 ขั้นตอนด้วยแอป Authenticator (TOTP) — ฟรี ไม่ต้องใช้ SMS
function MfaCard({ user, onChange }) {
  const toast = useToast()
  const [step, setStep] = useState('idle') // idle | scan | codes
  const [setup, setSetup] = useState(null)
  const [code, setCode] = useState('')
  const [codes, setCodes] = useState([])
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (fn) => {
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast.error(err.response?.data?.message || 'ทำรายการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const start = () => run(async () => {
    setSetup(await mfaSetup())
    setStep('scan')
  })
  const confirm = (e) => {
    e.preventDefault()
    run(async () => {
      const r = await mfaEnable(code.trim())
      onChange(r.user)
      setCodes(r.backupCodes)
      setStep('codes')
      setCode('')
      toast.success('เปิดใช้ MFA แล้ว')
    })
  }
  const disable = () => run(async () => {
    const r = await mfaDisable(password)
    onChange(r.user)
    setPassword('')
    toast.success('ปิด MFA แล้ว')
  })
  const regen = () => run(async () => {
    const r = await mfaNewBackupCodes(password)
    setCodes(r.backupCodes)
    setPassword('')
    setStep('codes')
  })

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h3 className="font-semibold flex-1">ยืนยันตัวตน 2 ขั้นตอน (MFA)</h3>
        <span className={`text-[12px] px-2.5 py-0.5 rounded-full ${user?.mfaEnabled ? 'bg-oksoft text-ok' : 'bg-surface2 text-muted'}`}>
          {user?.mfaEnabled ? 'เปิดใช้อยู่' : 'ปิดอยู่'}
        </span>
      </div>
      <p className="text-[12px] text-muted mb-4">
        นอกจากรหัสผ่าน ต้องกรอกรหัส 6 หลักจากแอปในมือถือทุกครั้งที่เข้าสู่ระบบ — แม้รหัสผ่านหลุด คนอื่นก็เข้าบัญชีไม่ได้
        {user?.role === 'admin' && <b className="text-ink"> แนะนำอย่างยิ่งสำหรับบัญชี Admin</b>}
      </p>

      {step === 'codes' && (
        <div className="rounded-2xl border border-warn/40 bg-warnsoft p-4 mb-4">
          <p className="text-[13px] font-semibold text-warn">รหัสสำรอง — จดหรือพิมพ์เก็บไว้ตอนนี้ (แสดงครั้งเดียว)</p>
          <p className="text-[12px] text-muted mb-3">ใช้แทนรหัส 6 หลักได้ชุดละ 1 ครั้ง เมื่อทำมือถือหาย</p>
          <div className="grid grid-cols-2 gap-2 font-mono text-[14px]">
            {codes.map((c) => <span key={c} className="bg-surface rounded-lg px-3 py-1.5 text-center">{c}</span>)}
          </div>
          <Btn className="mt-3" onClick={() => setStep('idle')}>จดเรียบร้อยแล้ว</Btn>
        </div>
      )}

      {!user?.mfaEnabled && step === 'idle' && (
        <Btn variant="primary" onClick={start} disabled={busy}>เปิดใช้ MFA</Btn>
      )}

      {step === 'scan' && setup && (
        <div className="space-y-4">
          <ol className="text-[13px] space-y-1 list-decimal pl-5">
            <li>ติดตั้งแอป <b>Google Authenticator</b> หรือ <b>Microsoft Authenticator</b> ในมือถือ</li>
            <li>กด + ในแอป แล้วสแกน QR นี้</li>
            <li>กรอกรหัส 6 หลักที่แอปแสดง</li>
          </ol>
          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-white p-3 rounded-2xl"><QRCodeSVG value={setup.otpauthUrl} size={150} /></div>
            <div className="text-[12px] text-muted">
              สแกนไม่ได้? พิมพ์รหัสนี้ในแอปแทน
              <p className="font-mono text-[13px] text-ink break-all mt-1">{setup.secret.match(/.{1,4}/g).join(' ')}</p>
            </div>
          </div>
          <form onSubmit={confirm} className="flex flex-wrap gap-2 items-end">
            <Field label="รหัส 6 หลักจากแอป" inputMode="numeric" autoComplete="one-time-code" value={code}
              onChange={(e) => setCode(e.target.value)} className="w-48" />
            <Btn type="submit" variant="primary" disabled={busy || code.trim().length < 6}>ยืนยันและเปิดใช้</Btn>
            <Btn type="button" onClick={() => setStep('idle')}>ยกเลิก</Btn>
          </form>
        </div>
      )}

      {user?.mfaEnabled && step === 'idle' && (
        <div className="flex flex-wrap gap-2 items-end">
          <Field label="ยืนยันด้วยรหัสผ่าน" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} className="w-56" />
          <Btn onClick={regen} disabled={busy || !password}>สร้างรหัสสำรองใหม่</Btn>
          <Btn onClick={disable} disabled={busy || !password} className="text-bad">ปิด MFA</Btn>
        </div>
      )}
    </Card>
  )
}
