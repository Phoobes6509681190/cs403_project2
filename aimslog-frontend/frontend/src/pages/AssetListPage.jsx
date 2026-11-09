import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUsers } from '../services/userService'
import Icon from '../components/icon'
import {
  Card, Btn, StatusPill, Field, SelectField, Modal, ConfirmDialog,
  LoadingState, ErrorState, EmptyState, useToast,
} from '../components/UI'
import { STATUS_OPTIONS } from '../data/statusConfig'
import { getAssets, createAsset, updateAsset, deleteAsset } from '../services/assetService'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../hooks/useAuth'
import { nf } from '../utils/format'

const PER_PAGE = 10

// ประกอบ "ระบุ สถานที่ใช้งาน" จาก ตึก/ชั้น/ห้อง (รูปแบบเดียวกับไฟล์ Excel ของคณะ)
const composeLocation = (f) =>
  [f.building, f.floor && `ชั้น ${f.floor}`, f.roomNo && `ห้อง ${f.roomNo}`].filter(Boolean).join(' ')

const emptyForm = {
  code: '', name: '', model: '', brand: '', cat: '', building: '', floor: '', roomNo: '', room: '', owner: '', holderUser: '', budget: '', price: '', status: 'ok',
}

export default function AssetListPage() {
  const { role } = useAuth()
  const canEdit = role === 'admin'
  const toast = useToast()

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [room, setRoom] = useState('')
  const [budget, setBudget] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQ = useDebounce(q, 400)

  const [result, setResult] = useState({ items: [], total: 0, rooms: [], budgets: [] })
  const [state, setState] = useState('loading')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [users, setUsers] = useState([])
  useEffect(() => {
    if (canEdit) getUsers({ active: 1 }).then((d) => setUsers(d.items || [])).catch(() => {})
  }, [canEdit])

  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setState('loading')
    try {
      const data = await getAssets({
        q: debouncedQ || undefined,
        status: status || undefined,
        room: room || undefined,
        budget: budget || undefined,
        page,
        perPage: PER_PAGE,
      })
      setResult(data)
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, room, budget, page])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, status, room, budget])

  // มี ตึก/ชั้น/ห้อง อย่างน้อยหนึ่งช่อง -> "ระบุสถานที่ใช้งาน" สร้างจาก 3 ช่องนี้เสมอ (สองค่าไม่มีทางไม่ตรงกัน)
  // ไม่มีเลยสักช่อง -> พิมพ์เองได้ เช่น "ห้องพักอาจารย์"
  const hasParts = (f) => !!(f.building || f.floor || f.roomNo)
  const setLocPart = (key, value) =>
    setForm((f) => {
      const next = { ...f, [key]: value }
      return hasParts(next) ? { ...next, room: composeLocation(next) } : next
    })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (asset) => {
    setEditing(asset)
    // เอาเฉพาะฟิลด์ในฟอร์ม (ไม่ส่ง location/codeParts เดิมกลับไปทับค่าที่แก้)
    const f = {
      ...Object.fromEntries(Object.keys(emptyForm).map((k) => [k, asset[k] ?? ''])),
      building: asset.location?.building || '',
      floor: asset.location?.floor || '',
      roomNo: asset.location?.room || '',
    }
    // ข้อมูลเก่าที่สองช่องไม่ตรงกัน จะถูกปรับให้ตรงเมื่อกดบันทึก
    setForm(hasParts(f) ? { ...f, room: composeLocation(f) } : f)
    setFormOpen(true)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // ส่งสถานที่แยกช่องเหมือนไฟล์ Excel — ถ้าเว้น "ระบุสถานที่ใช้งาน" ระบบประกอบจาก ตึก/ชั้น/ห้อง ให้
      const { building, floor, roomNo, room, ...rest } = form
      const payload = { ...rest, location: { building, floor, room: roomNo, label: room } }
      if (editing) {
        await updateAsset(editing.id, payload)
        toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว')
      } else {
        await createAsset(payload)
        toast.success('เพิ่มครุภัณฑ์เรียบร้อยแล้ว')
      }
      setFormOpen(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกข้อมูลไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    setDeleting(true)
    try {
      await deleteAsset(toDelete.id)
      toast.success('ลบครุภัณฑ์เรียบร้อยแล้ว')
      setToDelete(null)
      load()
    } catch {
      toast.error('ลบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setDeleting(false)
    }
  }

  const pages = Math.max(1, Math.ceil((result.total || 0) / PER_PAGE))
  const rooms = result.rooms || []
  const budgets = result.budgets || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold mr-auto">รายการครุภัณฑ์ทั้งหมด</h2>
        {canEdit && (
          <Link
            to={`/assets/labels?${new URLSearchParams(
              Object.entries({ q: debouncedQ, status, room, budget }).filter(([, v]) => v)
            )}`}
          >
            <Btn>พิมพ์ QR ({nf(result.total || 0)})</Btn>
          </Link>
        )}
        {canEdit && (
          <Btn variant="primary" onClick={openCreate}>
            <Icon name="plus" /> เพิ่มครุภัณฑ์
          </Btn>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint">
              <Icon name="search" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาเลขครุภัณฑ์ ชื่อ ยี่ห้อ สถานที่ หรือผู้ถือครอง"
              className="w-full rounded-xl border border-line bg-surface pl-10 pr-3 py-2 text-[13px] placeholder:text-faint"
            />
          </div>

          <span className="flex items-center gap-1.5 text-[12px] text-muted">
            <Icon name="filter" /> กรอง
          </span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
            <option value="">ทุกสถานะ</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
          <select value={room} onChange={(e) => setRoom(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
            <option value="">ทุกห้อง</option>
            {rooms.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <select value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
            <option value="">ทุกงบประมาณ</option>
            {budgets.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <span className="text-[12px] text-faint ml-auto">พบ {nf(result.total || 0)} รายการ</span>
        </div>

        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState onRetry={load} message="โหลดรายการครุภัณฑ์ไม่สำเร็จ" />}

        {state === 'ready' && (
          <>
            <div className="scroll-x">
              {/* คอลัมน์เรียงตามไฟล์ Excel ของคณะ + ผู้ถือครอง */}
              <table className="w-full min-w-[1150px] text-[13px]">
                <thead>
                  <tr className="text-[12px] text-muted border-b border-line">
                    {['ลำดับ', 'ตึก/อาคาร', 'ชั้น', 'ห้อง', 'ระบุ สถานที่ใช้งาน', 'สภาพ', 'รหัสสินทรัพย์อ้างอิง', 'ชื่อสินทรัพย์', 'ยี่ห้อ', 'ผู้ถือครอง', ''].map((h) => (
                      <th key={h} className="text-left font-medium py-2.5 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((a, i) => (
                    <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface2">
                      <td className="py-3 pr-3 text-faint tabular-nums">{(page - 1) * PER_PAGE + i + 1}</td>
                      <td className="py-3 pr-3 text-muted whitespace-nowrap">{a.location?.building || '—'}</td>
                      <td className="py-3 pr-3 text-muted">{a.location?.floor || '—'}</td>
                      <td className="py-3 pr-3 text-muted">{a.location?.room || '—'}</td>
                      <td className="py-3 pr-3 text-muted whitespace-nowrap">{a.room || '—'}</td>
                      <td className="py-3 pr-3"><StatusPill status={a.status} /></td>
                      <td className="py-3 pr-3 font-mono text-[12px] tabular-nums whitespace-nowrap">
                        <Link to={`/assets/${a.id}`} className="hover:text-brand hover:underline">{a.code}</Link>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium">{a.name}</p>
                        {a.model && <p className="text-[11px] text-faint">{a.model}</p>}
                      </td>
                      <td className="py-3 pr-3 text-muted">{a.brand || '—'}</td>
                      <td className="py-3 pr-3 text-muted whitespace-nowrap">{a.owner || '—'}</td>
                      <td className="py-3 pr-1">
                        <div className="flex items-center gap-1 justify-end text-faint">
                          <Link to={`/assets/${a.id}`} className="p-1.5 rounded-lg hover:text-brand hover:bg-brandsoft" title="ดูรายละเอียด">
                            <Icon name="history" />
                          </Link>
                          {canEdit && (
                            <>
                              <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:text-brand hover:bg-brandsoft" title="แก้ไข">
                                <Icon name="edit" />
                              </button>
                              <button onClick={() => setToDelete(a)} className="p-1.5 rounded-lg hover:text-bad hover:bg-badsoft" title="ลบ">
                                <Icon name="trash" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.items.length === 0 && <EmptyState message="ไม่พบครุภัณฑ์ที่ตรงกับเงื่อนไข" />}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between mt-4 text-[13px]">
                <span className="text-faint">หน้า {page} จาก {pages}</span>
                <div className="flex items-center gap-1">
                  <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="p-2 rounded-lg border border-line disabled:opacity-40">
                    <Icon name="left" />
                  </button>
                  <button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg border border-line disabled:opacity-40">
                    <Icon name="right" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'แก้ไขครุภัณฑ์' : 'เพิ่มครุภัณฑ์'}
        footer={
          <>
            <Btn onClick={() => setFormOpen(false)} disabled={saving}>ยกเลิก</Btn>
            <Btn variant="primary" type="submit" form="asset-form" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Btn>
          </>
        }
      >
        <form id="asset-form" onSubmit={submitForm} className="grid grid-cols-2 gap-3">
          <Field label="เลขครุภัณฑ์" placeholder="เช่น วทท-8พ-69-1/70" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Field label="ชื่อครุภัณฑ์" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="รุ่น" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <Field label="ยี่ห้อ" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <Field label="ประเภท" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} />
          <Field label="ตึก/อาคาร" placeholder="เช่น บร.2" value={form.building} onChange={(e) => setLocPart('building', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="ชั้น" value={form.floor} onChange={(e) => setLocPart('floor', e.target.value)} />
            <Field label="ห้อง" value={form.roomNo} onChange={(e) => setLocPart('roomNo', e.target.value)} />
          </div>
          <Field
            label="ระบุ สถานที่ใช้งาน"
            className="col-span-2"
            value={form.room}
            readOnly={hasParts(form)}
            placeholder="เช่น ห้องพักอาจารย์"
            hint={hasParts(form) ? 'สร้างจาก ตึก/ชั้น/ห้อง ให้อัตโนมัติ — ถ้าต้องการพิมพ์เอง ให้ล้างช่อง ตึก/ชั้น/ห้อง' : 'ใช้เมื่อไม่มีเลขห้อง'}
            onChange={(e) => setForm({ ...form, room: e.target.value })}
          />
          <Field label="ผู้ถือครอง" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <SelectField
            label="บัญชีผู้ถือครอง (ถ้ามี)"
            value={form.holderUser || ''}
            onChange={(e) => {
              const u = users.find((x) => x.id === e.target.value)
              setForm({ ...form, holderUser: e.target.value, owner: form.owner || u?.name || '' })
            }}
            options={[{ value: '', label: '— ไม่ผูกบัญชี —' }, ...users.map((u) => ({ value: u.id, label: u.name || u.username }))]}
          />
          <Field label="งบประมาณ" value={form.budget} placeholder="เว้นว่าง = ดูจากเลขครุภัณฑ์" hint="ระบบอ่านงบจากตัวย่อในเลขครุภัณฑ์ให้อัตโนมัติ" onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          <Field label="ราคา (บาท)" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <SelectField
            label="สถานะ"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={STATUS_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="ลบครุภัณฑ์"
        message={`ยืนยันลบ "${toDelete?.name}" หรือไม่? (ระบบจะซ่อนรายการนี้ไว้ ไม่ได้ลบถาวร สามารถกู้คืนได้ภายหลัง)`}
        confirmLabel="ลบ"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  )
}
