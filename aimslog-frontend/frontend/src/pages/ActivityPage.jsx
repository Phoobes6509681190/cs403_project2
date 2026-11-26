import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, LoadingState, ErrorState, EmptyState } from '../components/UI'
import { getActivity } from '../services/userService'
import { useDebounce } from '../hooks/useDebounce'
import { formatDateTimeTH, nf } from '../utils/format'

const ACTIONS = {
  create: { label: 'เพิ่ม', cls: 'bg-oksoft text-ok' },
  update: { label: 'แก้ไข', cls: 'bg-brandsoft text-brandink' },
  import: { label: 'นำเข้า', cls: 'bg-brandsoft text-brandink' },
  inspect: { label: 'ตรวจนับ', cls: 'bg-warnsoft text-warn' },
  delete: { label: 'ลบ', cls: 'bg-badsoft text-bad' },
  restore: { label: 'กู้คืน', cls: 'bg-surface2 text-muted' },
}

const input = 'rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint'

// บันทึกกิจกรรม — ใครทำอะไรกับครุภัณฑ์ เมื่อไหร่ (ผู้ดูแลระบบ)
// ค่าเริ่มต้นแสดงแบบ "สรุป": รวมเป็น ใคร/กิจกรรม/วัน -> กี่ชิ้น ล่าสุดเมื่อไหร่
// (นำเข้าครั้งเดียวเป็นหมื่นชิ้น ไม่ต้องไล่ทีละรายการ — feedback UAT) กดแถวเพื่อดูรายละเอียดทีละชิ้น
// ข้อมูลมาจากประวัติของครุภัณฑ์ทุกชิ้นรวมกัน ส่วนการเข้าสู่ระบบดูที่ "ประวัติการเข้าใช้"
const dayTH = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })

export default function ActivityPage() {
  const [mode, setMode] = useState('summary')
  const [f, setF] = useState({ action: '', by: '', q: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const by = useDebounce(f.by, 300)
  const q = useDebounce(f.q, 300)
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))

  const load = async () => {
    setState('loading')
    try {
      const params = {
        action: f.action || undefined, by: by || undefined, q: q || undefined, from: f.from || undefined, to: f.to || undefined,
        group: mode === 'summary' ? 1 : undefined, page, perPage: 50,
      }
      setData(await getActivity(params))
      setState('ready')
    } catch {
      setState('error')
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, f.action, by, q, f.from, f.to, page])
  useEffect(() => setPage(1), [mode, f.action, by, q, f.from, f.to])

  // กดแถวสรุป -> ดูรายการทีละชิ้นของคนนั้น/กิจกรรมนั้น/วันนั้น
  const drill = (g) => {
    setData(null)
    setState('loading')
    setF((p) => ({ ...p, action: g.action, by: g.by, from: g.day, to: g.day }))
    setMode('detail')
  }
  const switchMode = (m) => {
    setData(null)
    setState('loading')
    setMode(m)
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex rounded-full border border-line p-0.5 text-[12px]">
          {[['summary', 'สรุปรวม'], ['detail', 'ทีละรายการ']].map(([k, label]) => (
            <button
              key={k}
              onClick={() => switchMode(k)}
              className={`px-3 py-1 rounded-full ${mode === k ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === 'detail' && (f.by || f.action || f.from) && (
          <button
            onClick={() => setF({ action: '', by: '', q: '', from: '', to: '' })}
            className="text-[12px] text-muted hover:underline"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <select value={f.action} onChange={set('action')} className={input} aria-label="ประเภทกิจกรรม">
          <option value="">ทุกกิจกรรม</option>
          {Object.entries(ACTIONS).map(([k, a]) => <option key={k} value={k}>{a.label}</option>)}
        </select>
        <input value={f.by} onChange={set('by')} placeholder="ผู้ทำรายการ" className={`${input} w-40`} />
        <input value={f.q} onChange={set('q')} placeholder="เลขครุภัณฑ์ / ชื่อ" className={`${input} flex-1 min-w-[180px]`} />
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          ตั้งแต่ <input type="date" value={f.from} onChange={set('from')} className={input} />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-muted">
          ถึง <input type="date" value={f.to} onChange={set('to')} className={input} />
        </label>
      </div>
      {data && (
        <p className="text-[12px] text-muted mb-2">
          {data.grouped ? `${nf(data.total)} กลุ่มกิจกรรม — กดแถวเพื่อดูทีละชิ้น` : `พบ ${nf(data.total)} รายการ`}
        </p>
      )}
      {state === 'loading' && <LoadingState />}
      {state === 'error' && <ErrorState onRetry={load} message="โหลดบันทึกกิจกรรมไม่สำเร็จ" />}
      {state === 'ready' && data.items.length === 0 && <EmptyState message="ไม่มีกิจกรรมตามตัวกรอง" />}
      {state === 'ready' && data.grouped && data.items.length > 0 && (
        <div className="table-scroll">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="text-[12px] text-muted border-b border-line">
                {['วันที่', 'ผู้ทำรายการ', 'กิจกรรม', 'จำนวน', 'ล่าสุด'].map((h) => (
                  <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((g) => (
                <tr
                  key={`${g.day}-${g.by}-${g.action}`}
                  onClick={() => drill(g)}
                  className="border-b border-line last:border-0 cursor-pointer hover:bg-surface2"
                >
                  <td className="py-2 pr-3 whitespace-nowrap">{dayTH(g.day)}</td>
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{g.by || '—'}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${ACTIONS[g.action]?.cls || ''}`}>
                      {ACTIONS[g.action]?.label || g.action}
                    </span>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{nf(g.count)} ชิ้น</td>
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDateTimeTH(g.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state === 'ready' && !data.grouped && data.items.length > 0 && (
        <div className="table-scroll">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="text-[12px] text-muted border-b border-line">
                {['เวลา', 'ผู้ทำรายการ', 'กิจกรรม', 'ครุภัณฑ์', 'รายละเอียด'].map((h) => (
                  <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((h) => (
                <tr key={h.id} className="border-b border-line last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDateTimeTH(h.at)}</td>
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{h.by || '—'}</td>
                  <td className="py-2 pr-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${ACTIONS[h.action]?.cls || ''}`}>
                      {ACTIONS[h.action]?.label || h.action}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {h.asset ? (
                      <Link to={`/assets/${h.asset.id}`} className="hover:text-brand">
                        <span className="font-mono text-[12px]">{h.asset.code}</span>
                        <span className="block text-[12px] text-muted">{h.asset.name}</span>
                      </Link>
                    ) : <span className="text-faint">(ลบถาวรแล้ว)</span>}
                  </td>
                  <td className="py-2 pr-3 text-[12px] text-muted">{h.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state === 'ready' && pages > 1 && (
        <div className="flex items-center justify-end gap-2 mt-3 text-[12px] text-muted">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-full border border-line disabled:opacity-40">ก่อนหน้า</button>
          หน้า {page} / {pages}
          <button disabled={page === pages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-full border border-line disabled:opacity-40">ถัดไป</button>
        </div>
      )}
    </Card>
  )
}
