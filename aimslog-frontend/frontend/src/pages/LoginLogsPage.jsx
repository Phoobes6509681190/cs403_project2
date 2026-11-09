import { useEffect, useState } from 'react'
import { Card, LoadingState, ErrorState, EmptyState } from '../components/UI'
import { getLoginLogs } from '../services/userService'
import { useDebounce } from '../hooks/useDebounce'
import { formatDateTimeTH, nf } from '../utils/format'

const REASONS = {
  ok: 'เข้าสู่ระบบ',
  mfa_ok: 'เข้าสู่ระบบ (MFA)',
  mfa_backup: 'เข้าสู่ระบบ (รหัสสำรอง MFA)',
  wrong_password: 'รหัสผ่านผิด',
  no_user: 'ไม่มีบัญชีนี้',
  inactive: 'บัญชีถูกปิด',
  locked: 'บัญชีถูกล็อก',
  ip_limited: 'IP ถูกจำกัด',
  mfa_failed: 'รหัส MFA ผิด',
}

// ประวัติการเข้าสู่ระบบ (เก็บ 180 วัน) — ใช้ตรวจว่ามีคนพยายามเดารหัสบัญชีไหนหรือไม่
export default function LoginLogsPage() {
  const [q, setQ] = useState('')
  const [only, setOnly] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState(null)
  const [state, setState] = useState('loading')
  const dq = useDebounce(q, 300)

  const load = async () => {
    setState('loading')
    try {
      setData(await getLoginLogs({ username: dq || undefined, success: only || undefined, page, perPage: 50 }))
      setState('ready')
    } catch {
      setState('error')
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq, only, page])
  useEffect(() => setPage(1), [dq, only])

  const pages = data ? Math.max(1, Math.ceil(data.total / data.perPage)) : 1

  return (
    <div className="space-y-4">
      {data && (
        <Card className={`p-4 text-[13px] ${data.failed24h >= 10 ? 'border-bad/50 bg-badsoft' : ''}`}>
          เข้าสู่ระบบไม่สำเร็จใน 24 ชั่วโมงที่ผ่านมา: <b className="font-mono">{nf(data.failed24h)}</b> ครั้ง
          {data.failed24h >= 10 && <span className="text-bad"> — สูงผิดปกติ ตรวจดูว่ามีการเดารหัสบัญชีไหน</span>}
        </Card>
      )}
      <Card className="p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อผู้ใช้"
            className="flex-1 min-w-[200px] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint" />
          <select value={only} onChange={(e) => setOnly(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
            <option value="">ทั้งหมด</option>
            <option value="true">สำเร็จ</option>
            <option value="false">ไม่สำเร็จ</option>
          </select>
        </div>
        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState onRetry={load} message="โหลดประวัติไม่สำเร็จ" />}
        {state === 'ready' && data.items.length === 0 && <EmptyState message="ไม่มีประวัติ" />}
        {state === 'ready' && data.items.length > 0 && (
          <div className="scroll-x">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="text-[12px] text-muted border-b border-line">
                  {['เวลา', 'ชื่อผู้ใช้', 'ผล', 'IP', 'อุปกรณ์'].map((h) => (
                    <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted">{formatDateTimeTH(l.at)}</td>
                    <td className="py-2 pr-3 font-medium">{l.username || '—'}</td>
                    <td className={`py-2 pr-3 whitespace-nowrap ${l.success ? 'text-ok' : 'text-bad'}`}>{REASONS[l.reason] || l.reason}</td>
                    <td className="py-2 pr-3 font-mono text-[12px] text-muted">{l.ip || '—'}</td>
                    <td className="py-2 pr-3 text-[11px] text-faint max-w-[260px] truncate" title={l.userAgent}>{l.userAgent || '—'}</td>
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
    </div>
  )
}
