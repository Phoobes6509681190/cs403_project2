import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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

const emptyForm = {
  code: '', name: '', model: '', brand: '', cat: '', room: '', owner: '', budget: '', price: '', status: 'ok',
}

export default function AssetListPage() {
  const { role } = useAuth()
  const canEdit = role === 'admin'
  const toast = useToast()

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [room, setRoom] = useState('')
  const [page, setPage] = useState(1)
  const debouncedQ = useDebounce(q, 400)

  const [result, setResult] = useState({ items: [], total: 0, rooms: [] })
  const [state, setState] = useState('loading')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setState('loading')
    try {
      const data = await getAssets({
        q: debouncedQ || undefined,
        status: status || undefined,
        room: room || undefined,
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
  }, [debouncedQ, status, room, page])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, status, room])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormOpen(true)
  }

  const openEdit = (asset) => {
    setEditing(asset)
    setForm({ ...emptyForm, ...asset })
    setFormOpen(true)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await updateAsset(editing.id, form)
        toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว')
      } else {
        await createAsset(form)
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold mr-auto">รายการครุภัณฑ์ทั้งหมด</h2>
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
              placeholder="ค้นหารหัส ชื่อ หรือรุ่นครุภัณฑ์"
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

          <span className="text-[12px] text-faint ml-auto">พบ {nf(result.total || 0)} รายการ</span>
        </div>

        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState onRetry={load} message="โหลดรายการครุภัณฑ์ไม่สำเร็จ" />}

        {state === 'ready' && (
          <>
            <div className="scroll-x">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead>
                  <tr className="text-[12px] text-muted border-b border-line">
                    {['รหัสครุภัณฑ์', 'ชื่อครุภัณฑ์', 'ยี่ห้อ', 'สถานที่', 'ผู้ดูแล', 'สถานะ', ''].map((h) => (
                      <th key={h} className="text-left font-medium py-2.5 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((a) => (
                    <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface2">
                      <td className="py-3 pr-3 text-muted tabular-nums whitespace-nowrap">
                        <Link to={`/assets/${a.id}`} className="hover:text-brand hover:underline">{a.code}</Link>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="font-medium">{a.name}</p>
                        <p className="text-[11px] text-faint">{a.model}</p>
                      </td>
                      <td className="py-3 pr-3 text-muted">{a.brand}</td>
                      <td className="py-3 pr-3 text-muted whitespace-nowrap">{a.room}</td>
                      <td className="py-3 pr-3 text-muted whitespace-nowrap">{a.owner || '—'}</td>
                      <td className="py-3 pr-3"><StatusPill status={a.status} /></td>
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
          <Field label="รหัสครุภัณฑ์" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <Field label="ชื่อครุภัณฑ์" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Field label="รุ่น" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <Field label="ยี่ห้อ" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
          <Field label="ประเภท" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} />
          <Field label="สถานที่/ห้อง" required value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          <Field label="ผู้ดูแล" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          <Field label="งบประมาณ" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
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
