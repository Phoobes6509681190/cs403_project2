import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  Card, Btn, ProgressBar, ConfirmDialog, LoadingState, ErrorState, EmptyState, StatusPill, useToast,
} from '../components/UI'
import {
  getActiveInspection, getInspection, submitInspectionItem, getInspectionProgress, closeInspection,
} from '../services/inspectionService'
import { usePolling } from '../hooks/usePolling'
import { useDebounce } from '../hooks/useDebounce'
import { useAuth } from '../hooks/useAuth'
import { InspectButtons } from '../components/InspectButtons'
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
    setSubmittingId(assetId)
    try {
      const { item } = await submitInspectionItem(inspection.id, assetId, status)
      setInspection((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.assetId === assetId ? item : it)),
      }))
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

  const items = inspection?.items || []
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
          </div>
          {role === 'admin' && isOpen && (
            <Btn variant="danger" onClick={() => setConfirmClose(true)}>ปิดรอบ</Btn>
          )}
        </div>
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
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหาเลขครุภัณฑ์ ชื่อ ห้อง ผู้ถือครอง"
            className="flex-1 min-w-[200px] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint"
          />
        </div>

        <ul className="divide-y divide-line">
          {filtered.slice(0, MAX_SHOW).map((item) => (
            <li key={item.assetId} className="py-3 space-y-2">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <Link to={`/assets/${item.assetId}`} className="font-medium text-[13px] hover:text-brand">
                    {item.name}
                  </Link>
                  <p className="text-[11px] text-faint">
                    {item.code} · {item.room || 'ไม่ระบุสถานที่'}{item.owner ? ` · ${item.owner}` : ''}
                  </p>
                  {item.checked && (
                    <p className="text-[11px] text-muted">
                      ตรวจโดย {item.checkedBy} {item.method === 'self' && '(ผู้ถือครอง)'} · {formatDateTimeTH(item.checkedAt)}
                    </p>
                  )}
                </div>
                {item.checked && <StatusPill status={item.status} />}
              </div>
              {isOpen && item.canInspect && (
                <InspectButtons
                  current={item.status}
                  disabled={submittingId === item.assetId}
                  onPick={(s) => markStatus(item.assetId, s)}
                />
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
