import { canEdit as canEditRole, canDelete } from '../data/roles'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getUsers } from '../services/userService'
import Icon from '../components/icon'
import {
  Card, Btn, StatusPill, Modal, ConfirmDialog, Combobox,
  LoadingState, ErrorState, EmptyState, Spinner, useToast,
} from '../components/UI'
import AssetForm, { emptyAssetForm, assetToForm, formToPayload } from '../components/AssetForm'
import { STATUS_OPTIONS } from '../data/statusConfig'
import { getAssets, getAssetOptions, createAsset, updateAsset, deleteAsset, bulkDeleteAssets } from '../services/assetService'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../hooks/useAuth'
import { nf } from '../utils/format'

const PER_PAGE = 10

// คอลัมน์ตาราง (เรียงตามไฟล์ Excel ของคณะ + ผู้ถือครอง)
//   sort = ชื่อที่ส่งให้ API เรียงลำดับ, filter = ชื่อตัวกรองรายคอลัมน์ (dropdown ค่าที่มีอยู่)
const COLUMNS = [
  { label: 'ตึก/อาคาร', sort: 'building', filter: 'building', opt: 'building' },
  { label: 'ชั้น', sort: 'floor', filter: 'floor', opt: 'floor' },
  { label: 'ห้อง', sort: 'roomNo', filter: 'roomNo', opt: 'roomNo' },
  { label: 'สถานที่ใช้งาน', sort: 'room', filter: 'room', opt: 'room' },
  { label: 'สภาพ', sort: 'status', filter: 'status' },
  { label: 'รหัสสินทรัพย์อ้างอิง', sort: 'code' },
  { label: 'ชื่อสินทรัพย์', sort: 'name' },
  { label: 'ยี่ห้อ', sort: 'brand', filter: 'brand', opt: 'brand' },
  { label: 'รุ่น', sort: 'model', filter: 'model', opt: 'model' },
  { label: 'ประเภท', sort: 'cat', filter: 'cat', opt: 'cat' },
  { label: 'ผู้ถือครอง', sort: 'owner', filter: 'holder', opt: 'owner' },
]
const emptyFilters = { status: '', room: '', budget: '', year: '', building: '', floor: '', roomNo: '', brand: '', model: '', cat: '', holder: '' }

export default function AssetListPage() {
  const { role } = useAuth()
  const canEdit = canEditRole(role)
  const canRemove = canDelete(role) // ลบได้เฉพาะผู้ดูแลระบบ
  const toast = useToast()

  const [q, setQ] = useState('')
  const [filters, setFilters] = useState(emptyFilters)
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }))
  const activeFilters = Object.values(filters).filter(Boolean).length
  const [sort, setSort] = useState({ key: '', dir: 'asc' })
  // กดหัวคอลัมน์: น้อยไปมาก -> มากไปน้อย -> ค่าเริ่มต้น
  const toggleSort = (key) =>
    setSort((s) => (s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : { key: '', dir: 'asc' }))
  const [options, setOptions] = useState({})
  const loadOptions = () => getAssetOptions().then(setOptions).catch(() => {})
  useEffect(() => {
    loadOptions()
  }, [])
  const [selected, setSelected] = useState([]) // id ที่ติ๊กไว้ (พิมพ์ QR / ลบ) — จำข้ามหน้าได้
  const [allMatching, setAllMatching] = useState(false) // เลือก "ทุกรายการตามตัวกรอง" (ไม่ใช่แค่หน้านี้)
  const toggleSel = (id) => {
    setAllMatching(false)
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  const clearSel = () => {
    setSelected([])
    setAllMatching(false)
  }
  const [bulkOpen, setBulkOpen] = useState(false)
  const [page, setPage] = useState(1)
  const debouncedQ = useDebounce(q, 400)

  const [result, setResult] = useState({ items: [], total: 0, rooms: [], budgets: [] })
  const [state, setState] = useState('loading')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyAssetForm)
  const [saving, setSaving] = useState(false)

  const [users, setUsers] = useState([])
  useEffect(() => {
    if (canEdit) getUsers({ active: 1 }).then((d) => setUsers(d.items || [])).catch(() => {})
  }, [canEdit])

  useEffect(() => setAllMatching(false), [debouncedQ, filters])

  const [toDelete, setToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const load = async () => {
    // โหลดครั้งแรกแสดงหน้ารอ ครั้งต่อไปคงตารางไว้ (ตัวกรองหัวคอลัมน์จะได้ไม่หาย)
    if (state !== 'ready') setState('loading')
    setRefreshing(true)
    try {
      const data = await getAssets({ ...filterQuery(), sort: sort.key || undefined, dir: sort.key ? sort.dir : undefined, page, perPage: PER_PAGE })
      setResult(data)
      setState('ready')
    } catch {
      setState('error')
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, filters, sort, page])

  useEffect(() => {
    setPage(1)
  }, [debouncedQ, filters, sort])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyAssetForm)
    setFormOpen(true)
  }

  const openEdit = (asset) => {
    setEditing(asset)
    setForm(assetToForm(asset))
    setFormOpen(true)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = formToPayload(form)
      if (editing) {
        await updateAsset(editing.id, payload)
        toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว')
      } else {
        await createAsset(payload)
        toast.success('เพิ่มครุภัณฑ์เรียบร้อยแล้ว')
      }
      setFormOpen(false)
      load()
      loadOptions()
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

  function filterQuery() {
    return {
      q: debouncedQ || undefined,
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    }
  }
  const selCount = allMatching ? result.total || 0 : selected.length

  const confirmBulkDelete = async () => {
    setDeleting(true)
    try {
      const r = await bulkDeleteAssets(
        allMatching ? { all: true, query: filterQuery(), expected: result.total } : { ids: selected }
      )
      toast.success(`ย้าย ${nf(r.deleted)} รายการไปถังขยะแล้ว`)
      setBulkOpen(false)
      clearSel()
      setPage(1)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setDeleting(false)
    }
  }

  const pages = Math.max(1, Math.ceil((result.total || 0) / PER_PAGE))
  const budgets = result.budgets || []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold mr-auto">รายการครุภัณฑ์ทั้งหมด</h2>
        {canEdit && selCount > 0 && (
          <>
            {!allMatching && (
              <Link to={`/assets/labels?ids=${selected.join(',')}`}>
                <Btn>พิมพ์ QR ที่เลือก ({nf(selected.length)})</Btn>
              </Link>
            )}
            {canRemove && (
              <Btn variant="ghost" onClick={() => setBulkOpen(true)}>
                <span className="text-bad">ลบที่เลือก ({nf(selCount)})</span>
              </Btn>
            )}
            <button onClick={clearSel} className="text-[12px] text-muted hover:text-ink px-1">ล้างที่เลือก</button>
          </>
        )}
        {canEdit && (
          <Link to="/assets/labels?qr=unprinted">
            <Btn>พิมพ์ QR ใหม่ ({nf(result.qrUnprinted || 0)})</Btn>
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
          <Combobox compact className="w-44" value={filters.budget} onChange={(v) => setFilter('budget', v)} options={budgets} emptyLabel="ทุกงบประมาณ" />
          <Combobox compact className="w-32" value={filters.year} onChange={(v) => setFilter('year', v)} options={(result.years || []).map((y) => ({ value: String(y), label: `ปี ${y}` }))} emptyLabel="ทุกปีงบ" />
          {(activeFilters > 0 || sort.key) && (
            <button
              onClick={() => { setFilters(emptyFilters); setSort({ key: '', dir: 'asc' }) }}
              className="text-[12px] text-brand hover:underline px-1"
            >
              ล้างตัวกรอง{activeFilters ? ` (${activeFilters})` : ''}
            </button>
          )}
          {refreshing && <Spinner className="w-4 h-4 text-faint" />}

          <span className="text-[12px] text-faint ml-auto">พบ {nf(result.total || 0)} รายการ</span>
        </div>

        {canEdit && state === 'ready' && result.total > result.items.length && result.items.length > 0 &&
          result.items.every((a) => selected.includes(a.id)) && (
          <div className="px-4 py-2 text-[12px] text-center bg-brandsoft/50 border-b border-line">
            {allMatching ? (
              <>
                เลือกทั้งหมด {nf(result.total)} รายการตามตัวกรองแล้ว ·{' '}
                <button className="text-brand font-medium" onClick={clearSel}>ยกเลิก</button>
              </>
            ) : (
              <>
                เลือก {nf(result.items.length)} รายการในหน้านี้ ·{' '}
                <button className="text-brand font-medium" onClick={() => setAllMatching(true)}>
                  เลือกทั้งหมด {nf(result.total)} รายการตามตัวกรอง
                </button>
              </>
            )}
          </div>
        )}

        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState onRetry={load} message="โหลดรายการครุภัณฑ์ไม่สำเร็จ" />}

        {state === 'ready' && (
          <>
            <div className="scroll-x">
              {/* คอลัมน์เรียงตามไฟล์ Excel ของคณะ + ผู้ถือครอง */}
              <table className="w-full min-w-[1350px] text-[13px]">
                <thead>
                  <tr className="text-[12px] text-muted border-b border-line">
                    {canEdit && (
                      <th className="py-2.5 pr-2 w-8">
                        <input
                          type="checkbox"
                          aria-label="เลือกทั้งหน้า"
                          className="w-4 h-4"
                          checked={result.items.length > 0 && result.items.every((a) => selected.includes(a.id))}
                          onChange={(e) => {
                            setAllMatching(false)
                            setSelected((s) =>
                              e.target.checked
                                ? [...new Set([...s, ...result.items.map((a) => a.id)])]
                                : s.filter((id) => !result.items.some((a) => a.id === id))
                            )
                          }}
                        />
                      </th>
                    )}
                    <th className="text-left font-medium py-2.5 pr-3 whitespace-nowrap">ลำดับ</th>
                    {COLUMNS.map((c) => (
                      <th key={c.sort} className="text-left font-medium py-2.5 pr-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleSort(c.sort)}
                          className={`inline-flex items-center gap-1 rounded-md px-1 -mx-1 hover:text-ink hover:bg-surface2 ${sort.key === c.sort ? 'text-ink' : ''}`}
                          title="เรียงลำดับ"
                        >
                          {c.label}
                          <span className="text-[10px] w-2">{sort.key === c.sort ? (sort.dir === 'asc' ? '▲' : '▼') : ''}</span>
                        </button>
                      </th>
                    ))}
                    <th />
                  </tr>
                  {/* กรองรายคอลัมน์ — เลือกจากค่าที่มีอยู่ในระบบ */}
                  <tr className="border-b border-line">
                    {canEdit && <th />}
                    <th />
                    {COLUMNS.map((c) => (
                      <th key={c.sort} className="py-1.5 pr-2 font-normal">
                        {c.filter === 'status' ? (
                          <Combobox
                            compact
                            value={filters.status}
                            onChange={(v) => setFilter('status', v)}
                            options={STATUS_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
                            emptyLabel="ทั้งหมด"
                          />
                        ) : c.filter ? (
                          <Combobox compact value={filters[c.filter]} onChange={(v) => setFilter(c.filter, v)} options={options[c.opt] || []} emptyLabel="ทั้งหมด" />
                        ) : null}
                      </th>
                    ))}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((a, i) => (
                    <tr key={a.id} className={`border-b border-line last:border-0 hover:bg-surface2 ${selected.includes(a.id) ? 'bg-brandsoft/50' : ''}`}>
                      {canEdit && (
                        <td className="py-3 pr-2">
                          <input type="checkbox" aria-label="เลือก" className="w-4 h-4" checked={selected.includes(a.id)} onChange={() => toggleSel(a.id)} />
                        </td>
                      )}
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
                      </td>
                      <td className="py-3 pr-3 text-muted">{a.brand || '—'}</td>
                      <td className="py-3 pr-3 text-muted">{a.model || '—'}</td>
                      <td className="py-3 pr-3 text-muted whitespace-nowrap">{a.cat || '—'}</td>
                      <td className="py-3 pr-3 text-muted whitespace-nowrap">{a.owner || '—'}</td>
                      <td className="py-3 pr-1">
                        <div className="flex items-center gap-1 justify-end text-faint">
                          <Link to={`/assets/${a.id}`} className="p-1.5 rounded-lg hover:text-brand hover:bg-brandsoft" title="ดูรายละเอียด">
                            <Icon name="eye" />
                          </Link>
                          {canEdit && (
                            <>
                              <button onClick={() => openEdit(a)} className="p-1.5 rounded-lg hover:text-brand hover:bg-brandsoft" title="แก้ไข">
                                <Icon name="edit" />
                              </button>
                              {canRemove && (
                                <button onClick={() => setToDelete(a)} className="p-1.5 rounded-lg hover:text-bad hover:bg-badsoft" title="ลบ">
                                  <Icon name="trash" />
                                </button>
                              )}
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
        <AssetForm id="asset-form" form={form} setForm={setForm} onSubmit={submitForm} options={options} users={users} />
      </Modal>

      <ConfirmDialog
        open={bulkOpen}
        title="ลบหลายรายการ"
        message={
          allMatching
            ? `ยืนยันลบครุภัณฑ์ทั้งหมด ${nf(selCount)} รายการตามตัวกรองที่เลือกอยู่? (ย้ายไปถังขยะ กู้คืนได้ภายหลัง)`
            : `ยืนยันลบครุภัณฑ์ที่เลือก ${nf(selCount)} รายการ? (ย้ายไปถังขยะ กู้คืนได้ภายหลัง)`
        }
        confirmLabel={`ลบ ${nf(selCount)} รายการ`}
        danger
        loading={deleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkOpen(false)}
      />

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
