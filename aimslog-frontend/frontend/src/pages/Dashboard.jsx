import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Btn, StatCard, StatusPill, RoomBars, LoadingState, ErrorState } from '../components/UI'
import { getReportSummary } from '../services/reportService'
import { getAssets } from '../services/assetService'
import { pct } from '../utils/format'

export default function Dashboard() {
  const [summary, setSummary] = useState(null)
  const [latest, setLatest] = useState([])
  const [state, setState] = useState('loading') // loading | ready | error

  const load = async () => {
    setState('loading')
    try {
      const [summaryRes, assetsRes] = await Promise.all([
        getReportSummary(),
        getAssets({ page: 1, perPage: 4, sort: '-createdAt' }),
      ])
      setSummary(summaryRes)
      setLatest(assetsRes.items || [])
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดข้อมูลภาพรวมไม่สำเร็จ" />

  const { total = 0, byStatus = {}, byRoom = [] } = summary || {}
  const max = Math.max(1, ...byRoom.map((r) => r.count))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-5">
        <StatCard label="ทั้งหมด" value={total} sub="รายการในระบบ" />
        <StatCard label="ปกติ" value={byStatus.ok || 0} sub={`${pct(byStatus.ok, total)}% ของทั้งหมด`} color="var(--ok)" />
        <StatCard label="ชำรุด" value={byStatus.broken || 0} sub={`${pct(byStatus.broken, total)}% ของทั้งหมด`} color="var(--bad)" />
        <StatCard label="รอดำเนินการซ่อม" value={byStatus.repair || 0} sub={`${pct(byStatus.repair, total)}% ของทั้งหมด`} color="var(--warn)" />
        <StatCard label="ไม่พบครุภัณฑ์" value={byStatus.missing || 0} sub={`${pct(byStatus.missing, total)}% ของทั้งหมด`} color="var(--gone)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">รายการล่าสุด</h2>
            <Link to="/assets">
              <Btn className="py-1.5">ดูทั้งหมด</Btn>
            </Link>
          </div>

          <div className="scroll-x">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="text-[12px] text-muted border-b border-line">
                  <th className="text-left font-medium py-2 pr-3">รหัสครุภัณฑ์</th>
                  <th className="text-left font-medium py-2 pr-3">ชื่อครุภัณฑ์</th>
                  <th className="text-left font-medium py-2 pr-3">สถานที่</th>
                  <th className="text-left font-medium py-2">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="py-3 pr-3 text-muted tabular-nums">{a.code}</td>
                    <td className="py-3 pr-3">
                      <p className="font-medium">{a.name}</p>
                      <p className="text-[11px] text-faint">{a.model}</p>
                    </td>
                    <td className="py-3 pr-3 text-muted">{a.room}</td>
                    <td className="py-3">
                      <StatusPill status={a.status} />
                    </td>
                  </tr>
                ))}
                {latest.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted">
                      ยังไม่มีรายการครุภัณฑ์
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3">ครุภัณฑ์ตามห้อง</h2>
          {byRoom.length ? <RoomBars data={byRoom} max={max} /> : <p className="text-[13px] text-muted">ไม่มีข้อมูล</p>}
        </Card>
      </div>
    </div>
  )
}
