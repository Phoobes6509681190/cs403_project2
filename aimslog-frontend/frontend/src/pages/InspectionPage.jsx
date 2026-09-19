import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/icon'
import {
  Card, Btn, ProgressBar, ConfirmDialog, LoadingState, ErrorState, EmptyState, useToast,
} from '../components/UI'
import {
  getActiveInspection, submitInspectionItem, getInspectionProgress, closeInspection,
} from '../services/inspectionService'
import { usePolling } from '../hooks/usePolling'
import { useAuth } from '../hooks/useAuth'
import { nf } from '../utils/format'

const BIG_ACTIONS = [
  { key: 'ok', label: 'ปกติ', cls: 'bg-oksoft text-ok border-ok/30 hover:bg-ok hover:text-white' },
  { key: 'broken', label: 'ชำรุด', cls: 'bg-badsoft text-bad border-bad/30 hover:bg-bad hover:text-white' },
  { key: 'repair', label: 'รอซ่อม', cls: 'bg-warnsoft text-warn border-warn/30 hover:bg-warn hover:text-white' },
  { key: 'missing', label: 'ไม่พบ', cls: 'bg-gonesoft text-gone border-gone/30 hover:bg-gone hover:text-white' },
]

export default function InspectionPage() {
  const { role } = useAuth()
  const toast = useToast()
  const [inspection, setInspection] = useState(null)
  const [state, setState] = useState('loading')
  const [confirmClose, setConfirmClose] = useState(false)
  const [closing, setClosing] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)

  const load = async () => {
    setState('loading')
    try {
      const data = await getActiveInspection()
      setInspection(data)
      setState(data ? 'ready' : 'empty')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  // Sprint 4: progress bar แบบ real-time ด้วย polling (ดูเหตุผลเลือก polling ใน hooks/usePolling.js)
  const progressFetch = useCallback(() => {
    if (!inspection) return Promise.resolve(null)
    return getInspectionProgress(inspection.id)
  }, [inspection])

  const { data: progress } = usePolling(progressFetch, { intervalMs: 3000, enabled: !!inspection })

  const markStatus = async (assetId, status) => {
    setSubmittingId(assetId)
    try {
      await submitInspectionItem(inspection.id, assetId, status)
      setInspection((prev) => ({
        ...prev,
        items: prev.items.map((it) => (it.assetId === assetId ? { ...it, status, checked: true } : it)),
      }))
    } catch {
      toast.error('บันทึกผลตรวจนับไม่สำเร็จ')
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
    } catch {
      toast.error('ปิดรอบไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setClosing(false)
    }
  }

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

  const total = progress?.total ?? inspection.items.length
  const checked = progress?.checked ?? inspection.items.filter((i) => i.checked).length
  const pending = inspection.items.filter((i) => !i.checked)

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-semibold">รอบปีงบประมาณ {inspection.budgetYear}</p>
            <p className="text-[12px] text-muted">กรรมการ {inspection.committee?.length ?? 0} คน</p>
          </div>
          {role === 'admin' && (
            <Btn variant="danger" onClick={() => setConfirmClose(true)}>ปิดรอบ</Btn>
          )}
        </div>
        <div className="mt-4">
          <ProgressBar value={checked} max={total} label={`ตรวจแล้ว ${nf(checked)} จาก ${nf(total)} รายการ`} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">รายการที่ยังไม่ตรวจ ({nf(pending.length)})</h3>
        <ul className="divide-y divide-line">
          {pending.map((item) => (
            <li key={item.assetId} className="py-3 flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[13px]">{item.name}</p>
                <p className="text-[11px] text-faint truncate">{item.code} · {item.room}</p>
              </div>
              <div className="flex items-center gap-2">
                {BIG_ACTIONS.map((a) => (
                  <button
                    key={a.key}
                    disabled={submittingId === item.assetId}
                    onClick={() => markStatus(item.assetId, a.key)}
                    className={`px-4 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors disabled:opacity-50 ${a.cls}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </li>
          ))}
          {pending.length === 0 && <EmptyState message="ตรวจนับครบทุกรายการแล้ว 🎉" />}
        </ul>
      </Card>

      <ConfirmDialog
        open={confirmClose}
        title="ปิดรอบตรวจนับ"
        message={`ยืนยันปิดรอบตรวจนับปีงบประมาณ ${inspection.budgetYear}? หลังปิดรอบแล้วจะแก้ไขผลตรวจนับไม่ได้อีก`}
        confirmLabel="ปิดรอบ"
        danger
        loading={closing}
        onConfirm={handleClose}
        onCancel={() => setConfirmClose(false)}
      />
    </div>
  )
}
