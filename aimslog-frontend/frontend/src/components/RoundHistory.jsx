import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from './UI'
import { listInspections } from '../services/inspectionService'
import { formatDateTH, nf } from '../utils/format'

// ประวัติรอบตรวจนับทั้งหมด — ดูได้ว่าใครเปิด/ปิดรอบ และเหตุผลที่ Admin คนอื่นปิดแทน
export default function RoundHistory({ excludeId }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    listInspections().then((d) => setItems(d.items || [])).catch(() => {})
  }, [excludeId])

  const rows = items.filter((r) => r.id !== excludeId)
  if (!rows.length) return null

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-3">ประวัติรอบตรวจนับ</h3>
      <div className="scroll-x">
        <table className="w-full min-w-[760px] text-[13px]">
          <thead>
            <tr className="text-[12px] text-muted border-b border-line">
              {['ปีงบ', 'สถานะ', 'เปิดรอบโดย', 'ปิดรอบโดย', 'ตรวจแล้ว', ''].map((h) => (
                <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 align-top">
                <td className="py-2.5 pr-3 font-medium font-mono">{r.budgetYear}</td>
                <td className="py-2.5 pr-3 whitespace-nowrap">
                  {r.status === 'open' ? <span className="text-ok">กำลังตรวจ</span> : <span className="text-muted">ปิดแล้ว {formatDateTH(r.closedAt)}</span>}
                </td>
                <td className="py-2.5 pr-3">{r.createdBy || '—'}</td>
                <td className="py-2.5 pr-3">
                  {r.closedBy || '—'}
                  {r.closedByOther && (
                    <>
                      <span className="ml-1.5 text-[11px] px-2 py-0.5 rounded-full bg-warnsoft text-warn">ปิดแทน</span>
                      <p className="text-[12px] text-warn mt-1">เหตุผล: {r.closeReason}</p>
                    </>
                  )}
                </td>
                <td className="py-2.5 pr-3 whitespace-nowrap font-mono text-[12px]">
                  {nf(r.progress?.checked)}/{nf(r.progress?.total)}
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <Link to={`/inspection/${r.id}`} className="text-brand hover:underline text-[12px]">ดูรายละเอียด</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
