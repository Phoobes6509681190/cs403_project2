import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Card, Btn, ProgressBar, ConfirmDialog, LoadingState, ErrorState, EmptyState, StatusPill, useToast,
} from '../components/UI'
import {
  getActiveInspection, getInspection, submitInspectionItem, getInspectionProgress, closeInspection, bulkMarkRoom,
} from '../services/inspectionService'
import { usePolling } from '../hooks/usePolling'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../hooks/useAuth'
import { InspectButtons, INSPECT_ACTIONS } from '../components/InspectButtons'
import { STATUS } from '../data/statusConfig'
import { nf, formatDateTimeTH } from '../utils/format'

export default function InspectionPage() {
  const { id } = useParams()
  const { role } = useAuth()
  const toast = useToast()
  const [inspection, setInspection] = useState(null)
  const [state, setState] = useState('loading')
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)
  const [tab, setTab] = useState('pending')
  const [q, setQ] = useState('')
  const [room, setRoom] = useState('')
  const [editingId, setEditingId] = useState(null) // ชิ้นที่ตรวจแล้วและกำลังแก้ผล
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState('ok')
  const [bulking, setBulking] = useState(false)
  const debouncedQ = useDebounce(q, 200)

  const load = useCallback(async () => {
    setState('loading')
    try {
      const data = id ? await getInspection(id) : await getActiveInspection()
      setInspection(data)
      setState(data ? 'ready' : 'empty')
    } catch {
      setState('error')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const isOpen = inspection?.status === 'open'
  const progressFetch = useCallback(
    () => (inspection ? getInspectionProgress(inspection.id) : Promise.resolve(null)),
    [inspection]
  )
  // Real-time แบบ polling ทุก 3 วิ (เฉพาะรอบที่ยังเปิด)
  const { data: progress } = usePolling(progressFetch, { intervalMs: 3000, enabled: !!inspection && isOpen })

  const markStatus = async (assetId, status) => {
    // กันกดพลาด: ถ้าชิ้นนี้บันทึกผลไว้แล้ว ให้ยืนยันก่อนเปลี่ยน
    const prev = inspection.items.find((i) => i.assetId === assetId)
    if (prev?.checked && prev.status !== status && editingId !== assetId &&
        !window.confirm(`ชิ้นนี้บันทึกผลไว้แล้ว ต้องการเปลี่ยนเป็น "${STATUS[status].label}" หรือไม่?`)) return
    setSubmittingId(assetId)
    try {
      const { item } = await submitInspectionItem(inspection.id, assetId, status)
      setInspection((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.assetId === assetId ? item : it)),
      }))
      setEditingId(null)
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกผลตรวจนับไม่สำเร็จ')
    } finally {
      setSubmittingId(null)
    }
  }

  const handleClose = async () => {
    setClosing(true)
    try {
      await closeInspection(inspection.id)
      toast.success('ปิดรอบตรวจนับเรียบร้อยแล้ว')
      setConfirmClose(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'ปิดรอบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setClosing(false)
    }
  }

  const allItems = inspection?.items || []
  const rooms = useMemo(() => [...new Set(allItems.map((i) => i.room || ''))].sort(), [allItems])
  const items = useMemo(() => (room ? allItems.filter((i) => (i.room || '') === room) : allItems), [allItems, room])
  const roomPending = items.filter((i) => !i.checked).length

  const handleBulk = async () => {
    setBulking(true)
    try {
      const { updated } = await bulkMarkRoom(inspection.id, room, bulkStatus)
      toast.success(`บันทึก "${STATUS[bulkStatus].label}" ${nf(updated)} รายการในห้อง ${room || 'ไม่ระบุ'}`)
      setBulkOpen(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกทั้งห้องไม่สำเร็จ')
    } finally {
      setBulking(false)
    }
  }

  const filtered = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase()
    return items
      .filter((i) => (tab === 'pending' ? !i.checked : i.checked))
      .filter((i) => !needle || [i.code, i.name, i.room, i.owner].some((v) => v?.toLowerCase().includes(needle)))
  }, [items, tab, debouncedQ])

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดข้อมูลรอบตรวจนับไม่สำเร็จ" />

  if (state === 'empty') {
    return (
      <Card className="p-8">
        <EmptyState message="ยังไม่มีรอบตรวจนับที่เปิดอยู่ในขณะนี้" />
        {role === 'admin' && (
          <div className="text-center">
            <Link to="/inspection/committee">
              <Btn variant="primary">เริ่มรอบตรวจนับใหม่</Btn>
            </Link>
          </div>
        )}
      </Card>
    )
  }

  const mine = inspection.scope === 'mine'
  // ผู้ใช้ทั่วไปนับเฉพาะของตัวเอง, กรรมการใช้ตัวเลขรวมจาก polling
  const total = mine ? items.length : progress?.total ?? items.length
  const checked = mine ? items.filter((i) => i.checked).length : progress?.checked ?? items.filter((i) => i.checked).length
  const MAX_SHOW = 100

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">
              รอบปีงบประมาณ {inspection.budgetYear}{' '}
              {!isOpen && <span className="ml-1 text-[12px] font-normal text-muted">(ปิดแล้ว {formatDateTimeTH(inspection.closedAt)})</span>}
            </p>
            <p className="text-[12px] text-muted">
              กรรมการ: {inspection.committee.map((c) => c.name).join(', ') || '—'}
            </p>
            {mine && isOpen && (
              <p className="text-[12px] text-brand mt-1">
                คุณไม่ได้เป็นกรรมการรอบนี้ — ยืนยันสภาพครุภัณฑ์ที่คุณถือครองได้ด้านล่าง
              </p>
            )}
            {!mine && !inspection.isCommittee && isOpen && (
              <p className="text-[12px] text-warn mt-1">
                คุณดูความคืบหน้าได้อย่างเดียว — บันทึกผลได้เฉพาะกรรมการที่ได้รับแต่งตั้ง (กันการกดผิดแทนกรรมการ)
              </p>
            )}
          </div>
          {role === 'admin' && isOpen && (
            <Btn variant="danger" onClick={() => setConfirmClose(true)}>ปิดรอบ</Btn>
          )}
        </div>
        <p className="mt-3 text-[12px] text-muted bg-surface2 rounded-xl px-3 py-2">
          รอบตรวจนับ = การตรวจสอบพัสดุประจำปีงบประมาณ — ครุภัณฑ์แต่ละชิ้นนับ <b>1 ครั้งต่อรอบ</b> เพื่อยืนยันว่ายังอยู่และสภาพเป็นอย่างไร
          ชิ้นที่ตรวจแล้วจะย้ายไปแท็บ "ตรวจแล้ว" (กด "แก้ไขผล" ได้ถ้าบันทึกผิด) · เมื่อปิดรอบ ผลจะล็อกและใช้ออกรายงานประจำปี
        </p>
        <div className="mt-4">
          <ProgressBar value={checked} max={total} label={`ตรวจแล้ว ${nf(checked)} จาก ${nf(total)} รายการ`} />
          {!mine && progress?.selfChecked > 0 && (
            <p className="text-[11px] text-faint mt-1">ผู้ถือครองยืนยันเอง {nf(progress.selfChecked)} รายการ</p>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="flex rounded-xl border border-line p-1 text-[13px]">
            {[
              ['pending', `ยังไม่ตรวจ (${nf(items.filter((i) => !i.checked).length)})`],
              ['done', `ตรวจแล้ว (${nf(items.filter((i) => i.checked).length)})`],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg ${tab === k ? 'bg-brandsoft text-brandink font-medium' : 'text-muted'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {!mine && (
            <select value={room} onChange={(e) => setRoom(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
              <option value="">ทุกห้อง ({nf(rooms.length)})</option>
              {rooms.map((r) => (
                <option key={r} value={r}>{r || 'ไม่ระบุสถานที่'}</option>
              ))}
            </select>
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขครุภัณฑ์ ชื่อ ห้อง ผู้ถือครอง"
            className="flex-1 min-w-[200px] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint"
          />
        </div>

        {room && isOpen && inspection.isCommittee && roomPending > 0 && (
          <div className="mb-3 rounded-xl border border-line bg-surface2 px-4 py-3 flex flex-wrap items-center gap-3">
            <p className="text-[12px] text-muted flex-1 min-w-[220px]">
              <b className="text-ink">ตรวจทั้งห้อง:</b> กดชิ้นที่ต่างจากส่วนใหญ่ทีละชิ้นก่อน แล้วบันทึกผลให้ที่เหลือ {nf(roomPending)} ชิ้นในครั้งเดียว
            </p>
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px]"
              aria-label="ผลที่จะบันทึกให้ทั้งห้อง"
            >
              {INSPECT_ACTIONS.map((a) => (
                <option key={a.key} value={a.key}>{STATUS[a.key].label}</option>
              ))}
            </select>
            <Btn variant="primary" onClick={() => setBulkOpen(true)}>บันทึก {nf(roomPending)} ชิ้น</Btn>
          </div>
        )}
        <ul className="divide-y divide-line">
          {filtered.slice(0, MAX_SHOW).map((item) => (
            <li key={item.assetId} className="py-3 space-y-2">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/assets/${item.assetId}`} className="font-medium text-[13px] hover:text-brand">
                    {item.name}
                  </Link>
                  <p className="text-[11px] text-faint">
                    <span className="font-mono">{item.code}</span> · {item.room || 'ไม่ระบุสถานที่'}{item.owner ? ` · ${item.owner}` : ''}
                  </p>
                  {item.checked && (
                    <p className="text-[11px] text-muted">
                      ตรวจโดย {item.checkedBy} {item.method === 'self' && '(ผู้ถือครอง)'} · {formatDateTimeTH(item.checkedAt)}
                    </p>
                  )}
                </div>
                {item.checked && <StatusPill status={item.status} />}
                {item.checked && isOpen && item.canInspect && editingId !== item.assetId && (
                  <button onClick={() => setEditingId(item.assetId)} className="text-[12px] text-brand hover:underline whitespace-nowrap">
                    แก้ไขผล
                  </button>
                )}
              </div>
              {/* ยังไม่ตรวจ = แสดงปุ่มเลย, ตรวจแล้ว = ต้องกด "แก้ไขผล" ก่อน (กันกดซ้ำโดยไม่ตั้งใจ) */}
              {isOpen && item.canInspect && (!item.checked || editingId === item.assetId) && (
                <div className="space-y-1">
                  <InspectButtons
                    current={item.status}
                    disabled={submittingId === item.assetId}
                    onPick={(s) => markStatus(item.assetId, s)}
                  />
                  {editingId === item.assetId && (
                    <button onClick={() => setEditingId(null)} className="text-[12px] text-muted hover:underline">ยกเลิกการแก้ไข</button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
        {filtered.length > MAX_SHOW && (
          <p className="text-[12px] text-faint text-center pt-3">
            แสดง {MAX_SHOW} จาก {nf(filtered.length)} รายการ — พิมพ์ค้นหาเพื่อหาชิ้นที่ต้องการ
          </p>
        )}
        {filtered.length === 0 && (
          <EmptyState
            message={
              q ? 'ไม่พบรายการที่ค้นหา'
                : tab === 'pending' ? (items.length ? 'ตรวจนับครบทุกรายการแล้ว' : 'ไม่มีครุภัณฑ์ที่คุณถือครองในรอบนี้')
                : 'ยังไม่มีรายการที่ตรวจแล้ว'
            }
          />
        )}
      </Card>

      <ConfirmDialog
        open={bulkOpen}
        title={`ยืนยันห้อง ${room || 'ไม่ระบุสถานที่'}`}
        message={`บันทึกผล "${STATUS[bulkStatus].label}" ให้ครุภัณฑ์ที่ยังไม่ได้ตรวจ ${nf(roomPending)} ชิ้นในห้องนี้? ชิ้นที่บันทึกผลไว้แล้วจะไม่ถูกเปลี่ยน (แก้รายชิ้นภายหลังได้ในแท็บ "ตรวจแล้ว")`}
        confirmLabel={`บันทึก "${STATUS[bulkStatus].label}" ทั้งหมด`}
        loading={bulking}
        onConfirm={handleBulk}
        onCancel={() => setBulkOpen(false)}
      />

      <ConfirmDialog
        open={confirmClose}
        title="ปิดรอบตรวจนับ"
        message={`ยืนยันปิดรอบตรวจนับปีงบประมาณ ${inspection.budgetYear}? ยังไม่ได้ตรวจ ${nf(total - checked)} รายการ — หลังปิดรอบจะบันทึกผลเพิ่มไม่ได้อีก`}
        confirmLabel="ปิดรอบ"
        danger
        loading={closing}
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  )
}
