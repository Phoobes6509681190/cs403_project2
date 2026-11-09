import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import Icon from '../components/icon'
import { Btn, Card, LoadingState, ErrorState, EmptyState } from '../components/UI'
import { getAsset, getAssets, markQrPrinted } from '../services/assetService'
import { useToast } from '../components/UI'
import { nf } from '../utils/format'

// หน้าพิมพ์สติกเกอร์ QR — ?ids=a,b,c (ที่เลือก) · ?qr=unprinted (เฉพาะชิ้นที่ยังไม่เคยพิมพ์)
// หรือใช้ตัวกรองเดียวกับหน้ารายการ (?q=&status=&room=&budget=)
// QR เก็บลิงก์ไปหน้ารายละเอียด: สแกนด้วยกล้องมือถือได้เลย ไม่ต้องมีแอปสแกนในระบบ
export default function AssetLabelsPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [assets, setAssets] = useState([])
  const [state, setState] = useState('loading')
  const [askMark, setAskMark] = useState(false) // หลังสั่งพิมพ์: ถามว่าจะทำเครื่องหมายว่าพิมพ์แล้วไหม
  const [marking, setMarking] = useState(false)
  const toast = useToast()
  const onlyNew = params.get('qr') === 'unprinted'

  const load = async () => {
    setState('loading')
    try {
      const ids = params.get('ids')
      if (ids) {
        setAssets(await Promise.all(ids.split(',').filter(Boolean).map(getAsset)))
      } else {
        const filters = Object.fromEntries(['q', 'status', 'room', 'budget', 'qr'].map((k) => [k, params.get(k) || undefined]))
        const all = []
        for (let page = 1; page <= 50; page++) {
          const data = await getAssets({ ...filters, page, perPage: 200 })
          all.push(...data.items)
          if (all.length >= data.total || data.items.length === 0) break
        }
        // พิมพ์ชิ้นใหม่: ไม่ต้องพิมพ์ของที่ตัดโอนไปแล้ว
        setAssets(onlyNew ? all.filter((a) => a.status !== 'transferred') : all)
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
        <p className="text-[13px] mr-auto">
          {onlyNew ? 'QR ที่ยังไม่เคยพิมพ์' : 'สติกเกอร์ QR'} {nf(assets.length)} ชิ้น
        </p>
        <Btn
          variant="primary"
          disabled={!assets.length}
          onClick={() => {
            window.print()
            setAskMark(true)
          }}
        >
          พิมพ์
        </Btn>
      </Card>

      {askMark && assets.length > 0 && (
        <Card className="p-4 flex flex-wrap items-center gap-3 print:hidden border-brand/40">
          <p className="text-[13px] mr-auto">พิมพ์ {nf(assets.length)} ชิ้นนี้เรียบร้อยแล้ว?</p>
          <Btn onClick={() => setAskMark(false)} disabled={marking}>ยังไม่ได้พิมพ์</Btn>
          <Btn
            variant="primary"
            disabled={marking}
            onClick={async () => {
              setMarking(true)
              try {
                const r = await markQrPrinted(assets.map((a) => a.id))
                toast.success(`บันทึกว่าพิมพ์แล้ว ${nf(r.updated)} ชิ้น`)
                setAskMark(false)
                if (onlyNew) navigate('/assets')
              } catch {
                toast.error('บันทึกไม่สำเร็จ')
              } finally {
                setMarking(false)
              }
            }}
          >
            พิมพ์แล้ว
          </Btn>
        </Card>
      )}

      {assets.length === 0 ? (
        <EmptyState message={onlyNew ? 'พิมพ์ QR ครบทุกชิ้นแล้ว' : 'ไม่มีครุภัณฑ์ให้พิมพ์'} />
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
