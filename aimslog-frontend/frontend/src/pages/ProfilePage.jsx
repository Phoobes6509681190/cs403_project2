import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/icon'
import { Card, Btn, Field, Avatar, RolePill, StatusPill, EmptyState, useToast } from '../components/UI'
import { useAuth } from '../hooks/useAuth'
import { updateProfile, changePassword } from '../services/authService'
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
  const [tab, setTab] = useState('assets')
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
            ['password', 'รหัสผ่าน'],
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
      {tab === 'password' && <PasswordForm />}
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
