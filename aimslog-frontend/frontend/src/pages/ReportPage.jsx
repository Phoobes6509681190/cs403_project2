import { useEffect, useState } from 'react'
import Icon from '../components/icon'
import { Card, Btn, StatCard, RoomBars, Donut, LoadingState, ErrorState, useToast } from '../components/UI'
import { getReportSummary, getReportDetail, exportReport } from '../services/reportService'
import { STATUS } from '../data/statusConfig'
import { nf, pct } from '../utils/format'

export default function ReportPage() {
  const toast = useToast()
  const [summary, setSummary] = useState(null)
  const [detail, setDetail] = useState([])
  const [state, setState] = useState('loading')
  const [exporting, setExporting] = useState('')

  const load = async () => {
    setState('loading')
    try {
      const [s, d] = await Promise.all([getReportSummary(), getReportDetail()])
      setSummary(s)
      setDetail(d.items || [])
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleExport = async (format) => {
    setExporting(format)
    try {
      await exportReport(format)
    } catch {
      toast.error('ส่งออกไฟล์ไม่สำเร็จ')
    } finally {
      setExporting('')
    }
  }

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดรายงานไม่สำเร็จ" />

  const { total = 0, byStatus = {}, byRoom = [] } = summary || {}
  const donutData = Object.entries(STATUS).map(([key, s]) => ({
    label: s.label,
    value: byStatus[key] || 0,
    color: s.dot,
  }))
  const max = Math.max(1, ...byRoom.map((r) => r.count))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold mr-auto">รายงานสรุปครุภัณฑ์</h2>
        <Btn onClick={() => handleExport('excel')} disabled={exporting === 'excel'}>
          <Icon name="down" /> {exporting === 'excel' ? 'กำลังส่งออก...' : 'นำออก Excel'}
        </Btn>
        <Btn variant="primary" onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}>
          <Icon name="down" /> {exporting === 'pdf' ? 'กำลังส่งออก...' : 'นำออก PDF'}
        </Btn>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
        <StatCard label="ทั้งหมด" value={total} sub="รายการในระบบ" />
        <StatCard label="ปกติ" value={byStatus.ok || 0} sub={`${pct(byStatus.ok, total)}%`} color="var(--ok)" />
        <StatCard label="ชำรุด" value={byStatus.broken || 0} sub={`${pct(byStatus.broken, total)}%`} color="var(--bad)" />
        <StatCard label="ไม่พบครุภัณฑ์" value={byStatus.missing || 0} sub={`${pct(byStatus.missing, total)}%`} color="var(--gone)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="font-semibold mb-3">สัดส่วนสถานะ</h3>
          <div className="flex items-center gap-4">
            <Donut data={donutData} total={total} />
            <ul className="space-y-2 text-[12px]">
              {donutData.map((d) => (
                <li key={d.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-muted">{d.label}</span>
                  <span className="text-faint tabular-nums">{pct(d.value, total)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card className="lg:col-span-2 p-4">
          <h3 className="font-semibold mb-3">จำนวนตามห้อง</h3>
          {byRoom.length ? <RoomBars data={byRoom} max={max} /> : <p className="text-[13px] text-muted">ไม่มีข้อมูล</p>}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold mb-3">ตารางรายละเอียดทั้งหมด</h3>
        <div className="scroll-x">
          <table className="w-full min-w-[700px] text-[13px]">
            <thead>
              <tr className="text-[12px] text-muted border-b border-line">
                {['รหัสครุภัณฑ์', 'ชื่อครุภัณฑ์', 'งบประมาณ', 'สถานที่', 'สถานะ'].map((h) => (
                  <th key={h} className="text-left font-medium py-2.5 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pr-3 tabular-nums text-muted whitespace-nowrap">{r.code}</td>
                  <td className="py-2.5 pr-3">{r.name}</td>
                  <td className="py-2.5 pr-3 text-muted">{r.budget || '—'}</td>
                  <td className="py-2.5 pr-3 text-muted whitespace-nowrap">{r.room}</td>
                  <td className="py-2.5 pr-3 text-muted">{STATUS[r.status]?.label || r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detail.length === 0 && <p className="py-8 text-center text-muted">ไม่มีข้อมูล</p>}
        </div>
      </Card>
    </div>
  )
}
