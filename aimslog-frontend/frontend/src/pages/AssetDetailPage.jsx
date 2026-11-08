import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Icon from '../components/icon'
import { Card, StatusPill, LoadingState, ErrorState, EmptyState } from '../components/UI'
import { QRCodeSVG } from 'qrcode.react'
import { STATUS } from '../data/statusConfig'
import { submitInspectionItem } from '../services/inspectionService'
import { InspectButtons } from '../components/InspectButtons'
import { useToast } from '../components/UI'
import { getAsset, getAssetHistory } from '../services/assetService'
import { formatDateTH, formatDateTimeTH, currency } from '../utils/format'

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [history, setHistory] = useState([])
  const [state, setState] = useState('loading')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const inspect = async (status) => {
    setSaving(true)
    try {
      await submitInspectionItem(asset.inspection.id, asset.id, status)
      toast.success(`บันทึกผลตรวจ: ${STATUS[status].label}`)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกผลตรวจไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const load = async () => {
    setState('loading')
    try {
      const [assetData, historyData] = await Promise.all([getAsset(id), getAssetHistory(id)])
      setAsset(assetData)
      setHistory(historyData.items || [])
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดรายละเอียดครุภัณฑ์ไม่สำเร็จ" />

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/assets')} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <Icon name="left" className="w-4 h-4" /> กลับไปรายการครุภัณฑ์
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-faint tabular-nums">{asset.code}</p>
            <h2 className="text-lg font-bold">{asset.name}</h2>
            <p className="text-[13px] text-muted">{[asset.brand, asset.model].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          <StatusPill status={asset.status} />
        </div>
        {asset.status && STATUS[asset.status]?.hint && (
          <p className="mt-1 text-[11px] text-faint text-right">{STATUS[asset.status].hint}</p>
        )}

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
          <div><p className="text-faint text-[11px]">ประเภท</p><p>{asset.cat || '—'}</p></div>
          <div><p className="text-faint text-[11px]">สถานที่</p><p>{asset.room}</p></div>
          <div><p className="text-faint text-[11px]">ผู้ถือครอง</p><p>{asset.owner || '—'}</p></div>
          <div><p className="text-faint text-[11px]">งบประมาณ</p><p>{asset.budget || '—'}</p></div>
          <div><p className="text-faint text-[11px]">ราคา</p><p>{asset.price ? currency(asset.price) : '—'}</p></div>
          <div><p className="text-faint text-[11px]">ปีงบที่ซื้อ</p><p>{asset.codeParts?.year ? `พ.ศ. ${asset.codeParts.year < 100 ? 2500 + asset.codeParts.year : asset.codeParts.year}` : '—'}</p></div>
          <div><p className="text-faint text-[11px]">ลำดับในชุด</p><p>{asset.codeParts ? `${asset.codeParts.seq} จาก ${asset.codeParts.total}` : '—'}</p></div>
          <div><p className="text-faint text-[11px]">ตรวจนับล่าสุด</p><p>{formatDateTH(asset.lastInspectedAt)}</p></div>
        </div>
      </Card>

      {asset.inspection && (
        <Card className="p-4">
          <h3 className="font-semibold mb-1">ตรวจนับรอบปี {asset.inspection.budgetYear}</h3>
          <p className="text-[12px] text-muted mb-3">
            {asset.inspection.checked
              ? `ตรวจแล้วโดย ${asset.inspection.checkedBy} · ${formatDateTimeTH(asset.inspection.checkedAt)}`
              : 'ยังไม่ได้ตรวจในรอบนี้'}
          </p>
          {asset.inspection.canInspect ? (
            <InspectButtons disabled={saving} current={asset.inspection.result} onPick={inspect} />
          ) : (
            <p className="text-[12px] text-faint">คุณไม่ได้เป็นกรรมการหรือผู้ถือครองของรายการนี้</p>
          )}
        </Card>
      )}

      <Card className="p-4 flex items-center gap-4">
        <div className="bg-white p-2 rounded-lg">
          <QRCodeSVG value={`${window.location.origin}/assets/${asset.id}`} size={96} />
        </div>
        <div className="text-[12px] text-muted">
          <p className="font-medium text-ink text-[13px]">QR Code ของครุภัณฑ์ชิ้นนี้</p>
          <p>สแกนด้วยกล้องมือถือเพื่อเปิดหน้านี้ และกดบันทึกผลตรวจได้ทันที</p>
          <Link to={`/assets/labels?ids=${asset.id}`} className="text-brand hover:underline">พิมพ์สติกเกอร์</Link>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Icon name="history" className="w-4 h-4" /> ประวัติการเปลี่ยนแปลง
        </h3>

        {history.length === 0 ? (
          <EmptyState message="ยังไม่มีประวัติการเปลี่ยนแปลง" />
        ) : (
          <ol className="space-y-4">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand mt-1.5" />
                  <span className="flex-1 w-px bg-line" />
                </div>
                <div className="pb-1">
                  <p className="text-[13px] font-medium">{h.summary}</p>
                  <p className="text-[11px] text-faint">
                    {formatDateTimeTH(h.at)} · โดย {h.by || 'ระบบ'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
