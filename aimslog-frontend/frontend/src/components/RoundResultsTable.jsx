import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Btn, StatusPill, EmptyState } from './UI'
import { STATUS } from '../data/statusConfig'
import { nf, formatDateTimeTH } from '../utils/format'

// ตารางผลตรวจของรอบ (ดูย้อนหลังรายปีได้ เหมือนตารางครุภัณฑ์) — กรอง/เรียง/ส่งออก Excel
const COLS = [
  { key: 'code', label: 'เลขครุภัณฑ์', mono: true },
  { key: 'name', label: 'ชื่อ' },
  { key: 'room', label: 'สถานที่' },
  { key: 'owner', label: 'ผู้ถือครอง' },
  { key: 'statusBefore', label: 'สถานะก่อนตรวจ', status: true },
  { key: 'status', label: 'ผลตรวจ', status: true },
  { key: 'note', label: 'หมายเหตุ' },
  { key: 'checkedBy', label: 'ตรวจโดย' },
  { key: 'checkedAt', label: 'วันที่ตรวจ', date: true },
]

const text = (it, c) => {
  const v = it[c.key]
  if (c.status) return v ? STATUS[v]?.label || v : 'ยังไม่ตรวจ'
  if (c.date) return v ? formatDateTimeTH(v) : ''
  return v || ''
}

export default function RoundResultsTable({ inspection, items }) {
  const [result, setResult] = useState('')
  const [room, setRoom] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'room', dir: 1 })

  const rooms = useMemo(() => [...new Set(items.map((i) => i.room || ''))].sort(), [items])
  const counts = useMemo(() => {
    const c = { pending: 0 }
    for (const i of items) {
      if (!i.checked) c.pending += 1
      else c[i.status] = (c[i.status] || 0) + 1
    }
    return c
  }, [items])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const col = COLS.find((c) => c.key === sort.key)
    return items
      .filter((i) => (result === 'pending' ? !i.checked : !result || i.status === result))
      .filter((i) => !room || (i.room || '') === room)
      .filter((i) => !needle || [i.code, i.name, i.owner, i.note].some((v) => v?.toLowerCase().includes(needle)))
      .sort((a, b) => {
        const va = col.date ? a[col.key] || '' : text(a, col)
        const vb = col.date ? b[col.key] || '' : text(b, col)
        return String(va).localeCompare(String(vb), 'th', { numeric: true }) * sort.dir
      })
  }, [items, result, room, q, sort])

  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const data = rows.map((it) => Object.fromEntries(COLS.map((c) => [c.label, text(it, c)])))
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, `รอบ ${inspection.budgetYear}`)
    XLSX.writeFile(wb, `aimslog-inspection-${inspection.budgetYear}.xlsx`)
  }

  const MAX = 300
  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold mr-auto">ผลตรวจรอบปีงบประมาณ {inspection.budgetYear}</h3>
        <Btn onClick={exportExcel}>ส่งออก Excel</Btn>
      </div>

      <div className="flex flex-wrap gap-1.5 text-[12px]">
        {[['', `ทั้งหมด ${nf(items.length)}`], ['pending', `ยังไม่ตรวจ ${nf(counts.pending)}`],
          ...Object.keys(STATUS).filter((k) => counts[k]).map((k) => [k, `${STATUS[k].label} ${nf(counts[k])}`])].map(([k, label]) => (
          <button
            key={k || 'all'}
            onClick={() => setResult(k)}
            className={`px-3 py-1 rounded-full border ${result === k ? 'border-brand bg-brandsoft text-brandink' : 'border-line text-muted hover:border-ink/40'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={room} onChange={(e) => setRoom(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">ทุกห้อง ({nf(rooms.length)})</option>
          {rooms.map((r) => <option key={r} value={r}>{r || 'ไม่ระบุสถานที่'}</option>)}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาเลข ชื่อ ผู้ถือครอง หมายเหตุ"
          className="flex-1 min-w-[200px] rounded-xl border border-line bg-surface px-3 py-2 text-[13px] placeholder:text-faint"
        />
      </div>

      {rows.length ? (
        <div className="table-scroll">
          <table className="w-full min-w-[1100px] text-[13px]">
            <thead>
              <tr className="text-[12px] text-muted border-b border-line">
                {COLS.map((c) => (
                  <th key={c.key} className="text-left font-medium py-2 pr-3 whitespace-nowrap">
                    <button
                      onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key ? -s.dir : 1 }))}
                      className="hover:text-ink"
                    >
                      {c.label} {sort.key === c.key ? (sort.dir > 0 ? '▲' : '▼') : ''}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, MAX).map((it) => (
                <tr key={it.assetId} className="border-b border-line last:border-0 align-top">
                  {COLS.map((c) => (
                    <td key={c.key} className={`py-2 pr-3 ${c.mono ? 'font-mono text-[12px] whitespace-nowrap' : ''}`}>
                      {c.key === 'name' ? (
                        <Link to={`/assets/${it.assetId}`} className="hover:text-brand">{it.name}</Link>
                      ) : c.status ? (
                        it[c.key] ? <StatusPill status={it[c.key]} /> : <span className="text-faint">ยังไม่ตรวจ</span>
                      ) : (
                        text(it, c) || <span className="text-faint">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > MAX && (
            <p className="text-[12px] text-faint text-center pt-3">แสดง {MAX} จาก {nf(rows.length)} รายการ — ส่งออก Excel เพื่อดูทั้งหมด</p>
          )}
        </div>
      ) : (
        <EmptyState message="ไม่มีรายการตามตัวกรอง" />
      )}
    </Card>
  )
}
