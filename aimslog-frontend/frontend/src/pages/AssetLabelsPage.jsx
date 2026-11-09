import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../components/icon'
import { Btn, Card, LoadingState, ErrorState, EmptyState } from '../components/UI'
import { getAsset, getAssets } from '../services/assetService'
import { nf } from '../utils/format'

// หน้าพิมพ์สติกเกอร์ QR — ?ids=a,b,c หรือใช้ตัวกรองเดียวกับหน้ารายการ (?q=&status=&room=&budget=)
// QR เก็บลิงก์ไปหน้ารายละเอียด: สแกนด้วยกล้องมือถือได้เลย ไม่ต้องมีแอปสแกนในระบบ
export default function AssetLabelsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [state, setState] = useState('loading')

  const load = async () => {
    setState('loading')
    try {
      const ids = params.get('ids')
      if (ids) {
        setAssets(await Promise.all(ids.split(',').filter(Boolean).map(getAsset)))
      } else {
        const filters = Object.fromEntries(['q', 'status', 'room', 'budget'].map((k) => [k, params.get(k) || undefined]))
        const all = []
        for (let page = 1; page <= 50; page++) {
          const data = await getAssets({ ...filters, page, perPage: 200 })
          all.push(...data.items)
          if (all.length >= data.total || data.items.length === 0) break
        }
        setAssets(all)
      }
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  if (state === 'loading') return <LoadingState label="กำลังเตรียมสติกเกอร์..." />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดรายการไม่สำเร็จ" />

  const origin = window.location.origin

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center gap-3 print:hidden">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <Icon name="left" className="w-4 h-4" /> กลับ
        </button>
        <p className="text-[13px] mr-auto">สติกเกอร์ QR {nf(assets.length)} ชิ้น · พิมพ์บนกระดาษ A4 (3 คอลัมน์)</p>
        <Btn variant="primary" onClick={() => window.print()} disabled={!assets.length}>
          พิมพ์
        </Btn>
      </Card>

      {assets.length === 0 ? (
        <EmptyState message="ไม่มีครุภัณฑ์ให้พิมพ์" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 print:grid-cols-3 gap-2 print:gap-0">
          {assets.map((a) => (
            <div
              key={a.id}
              className="bg-white text-black border border-dashed border-gray-300 rounded-lg print:rounded-none p-2 flex items-center gap-2 break-inside-avoid overflow-hidden min-w-0"
            >
              <QRCodeSVG value={`${origin}/assets/${a.id}`} size={72} className="shrink-0" />
              <div className="min-w-0 text-[10px] leading-tight">
                <p className="font-bold text-[11px] break-all">{a.code}</p>
                <p className="line-clamp-2">{a.name}</p>
                <p className="text-gray-600 truncate">{a.room}</p>
                <p className="text-gray-500">AIMSlog · วิทยาการคอมพิวเตอร์</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
