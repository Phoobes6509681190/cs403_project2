import { useEffect, useMemo, useState } from 'react'
import { Card, Btn, Field, SelectField, Modal, ConfirmDialog, Avatar, RolePill, LoadingState, ErrorState, useToast } from '../components/UI'
import { getUsers, createUser, updateUser, resetUserPassword } from '../services/userService'
import { useAuth } from '../hooks/useAuth'

const MIN = 8
const emptyNew = { name: '', username: '', position: '', password: '', role: 'user' }

export default function UsersPage() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [state, setState] = useState('loading')
  const [q, setQ] = useState('')

  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState(emptyNew)
  const [saving, setSaving] = useState(false)

  const [resetFor, setResetFor] = useState(null)
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState(null) // { user, patch, title, message }

  const load = async () => {
    setState('loading')
    try {
      const d = await getUsers()
      setUsers(d.items || [])
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

  const add = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const u = await createUser(form)
      setUsers((p) => [...p, u])
      setAddOpen(false)
      setForm(emptyNew)
      toast.success(`เพิ่มผู้ใช้ ${u.name} แล้ว`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'เพิ่มผู้ใช้ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const applyConfirm = async () => {
    setSaving(true)
    try {
      const u = await updateUser(confirm.user.id, confirm.patch)
      setUsers((p) => p.map((x) => (x.id === u.id ? u : x)))
      toast.success('บันทึกแล้ว')
      setConfirm(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const doReset = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await resetUserPassword(resetFor.id, newPass)
      toast.success(`ตั้งรหัสผ่านใหม่ให้ ${resetFor.name} แล้ว`)
      setResetFor(null)
      setNewPass('')
    } catch (err) {
      toast.error(err.response?.data?.message || 'ตั้งรหัสผ่านไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดรายชื่อผู้ใช้ไม่สำเร็จ" />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อ ชื่อผู้ใช้ หรือตำแหน่ง"
          className="flex-1 min-w-[220px] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint"
        />
        <Btn variant="primary" onClick={() => setAddOpen(true)}>+ เพิ่มผู้ใช้</Btn>
      </div>

      <Card className="divide-y divide-line">
        {shown.map((u) => {
          const self = u.id === me?.id
          const isActive = u.active !== false
          return (
            <div key={u.id} className={`p-4 flex flex-wrap items-center gap-3 ${isActive ? '' : 'opacity-60'}`}>
              <Avatar user={u} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[14px]">
                  {u.name} {self && <span className="text-[11px] text-faint">(คุณ)</span>}
                  {!isActive && <span className="ml-1 text-[11px] text-bad">ปิดบัญชีแล้ว</span>}
                </p>
                <p className="text-[12px] text-muted">@{u.username}{u.position ? ` · ${u.position}` : ''}</p>
              </div>
              <RolePill role={u.role} />
              {!self && (
                <div className="flex flex-wrap gap-2">
                  <Btn
                    onClick={() =>
                      setConfirm({
                        user: u,
                        patch: { role: u.role === 'admin' ? 'user' : 'admin' },
                        title: 'เปลี่ยนสิทธิ์',
                        message: u.role === 'admin'
                          ? `ลดสิทธิ์ ${u.name} เป็นผู้ใช้ทั่วไป?`
                          : `ให้ ${u.name} เป็นเจ้าหน้าที่พัสดุ (Admin) — แก้ไข/ลบครุภัณฑ์ได้ทั้งหมด?`,
                      })
                    }
                  >
                    {u.role === 'admin' ? 'ลดเป็นผู้ใช้ทั่วไป' : 'ตั้งเป็น Admin'}
                  </Btn>
                  <Btn onClick={() => setResetFor(u)}>ตั้งรหัสใหม่</Btn>
                  <Btn
                    variant={isActive ? 'ghost' : 'primary'}
                    onClick={() =>
                      setConfirm({
                        user: u,
                        patch: { active: !isActive },
                        title: isActive ? 'ปิดบัญชี' : 'เปิดบัญชี',
                        message: isActive
                          ? `ปิดบัญชี ${u.name}? จะเข้าสู่ระบบไม่ได้ แต่ประวัติที่เคยบันทึกยังอยู่ครบ`
                          : `เปิดบัญชี ${u.name} ให้ใช้งานได้อีกครั้ง?`,
                      })
                    }
                  >
                    {isActive ? 'ปิดบัญชี' : 'เปิดบัญชี'}
                  </Btn>
                </div>
              )}
            </div>
          )
        })}
        {shown.length === 0 && <p className="p-6 text-center text-muted text-[13px]">ไม่พบผู้ใช้</p>}
      </Card>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="เพิ่มผู้ใช้"
        footer={
          <>
            <Btn onClick={() => setAddOpen(false)} disabled={saving}>ยกเลิก</Btn>
            <Btn variant="primary" type="submit" form="add-user" disabled={saving}>{saving ? 'กำลังเพิ่ม...' : 'เพิ่มผู้ใช้'}</Btn>
          </>
        }
      >
        <form id="add-user" onSubmit={add} className="grid sm:grid-cols-2 gap-3">
          <Field label="ชื่อ-สกุล" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="ตำแหน่ง" placeholder="เช่น อาจารย์, นักวิชาการ" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <Field label="ชื่อผู้ใช้ (ใช้ login)" required value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          <Field label="รหัสผ่านเริ่มต้น" type="text" required minLength={MIN} hint={`อย่างน้อย ${MIN} ตัว — แจ้งให้ผู้ใช้เปลี่ยนเองภายหลัง`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <SelectField
            label="สิทธิ์"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            options={[{ value: 'user', label: 'ผู้ใช้ทั่วไป' }, { value: 'admin', label: 'เจ้าหน้าที่พัสดุ (Admin)' }]}
          />
        </form>
      </Modal>

      <Modal
        open={!!resetFor}
        onClose={() => setResetFor(null)}
        title={`ตั้งรหัสผ่านใหม่ให้ ${resetFor?.name || ''}`}
        footer={
          <>
            <Btn onClick={() => setResetFor(null)} disabled={saving}>ยกเลิก</Btn>
            <Btn variant="primary" type="submit" form="reset-pass" disabled={saving || newPass.length < MIN}>บันทึก</Btn>
          </>
        }
      >
        <form id="reset-pass" onSubmit={doReset}>
          <Field label="รหัสผ่านใหม่" type="text" required minLength={MIN} hint="แจ้งรหัสนี้ให้ผู้ใช้ แล้วให้เปลี่ยนเองในหน้าโปรไฟล์" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="ยืนยัน"
        danger={confirm?.patch?.active === false}
        loading={saving}
        onConfirm={applyConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
