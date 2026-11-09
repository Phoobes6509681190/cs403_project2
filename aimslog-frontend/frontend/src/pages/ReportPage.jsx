import { useEffect, useState } from 'react'
import Icon from '../components/icon'
import { Card, Btn, StatCard, RoomBars, Donut, LoadingState, ErrorState, useToast } from '../components/UI'
import { getReportSummary, getReportDetail } from '../services/reportService'
import { getBudgets } from '../services/assetService'
import { STATUS } from '../data/statusConfig'
import { exportReportExcel, SUMMARY_COLUMNS } from '../utils/reportExport'
import { nf, pct, formatDateTH } from '../utils/format'

const DETAIL_SCREEN_LIMIT = 300

export default function ReportPage() {
  const toast = useToast()
  const [summary, setSummary] = useState(null)
  const [detail, setDetail] = useState({ items: [] })
  const [budgets, setBudgets] = useState([])
  const [budget, setBudget] = useState('')
  const [state, setState] = useState('loading')

  const load = async () => {
    setState('loading')
    try {
      const params = { budget: budget || undefined }
      const [s, d] = await Promise.all([getReportSummary(params), getReportDetail(params)])
      setSummary(s)
      setDetail(d)
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    getBudgets().then((d) => setBudgets(d.items || [])).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budget])

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดรายงานไม่สำเร็จ" />

  const { total, byStatus, byRoom, groups, totals, inspection } = summary
  const year = inspection?.budgetYear
  const title = `รายงานผลการตรวจสอบพัสดุประจำปี สาขาวิทยาการคอมพิวเตอร์${year ? ` ปีงบประมาณ ${year}` : ''}${budget ? ` (${budget})` : ''}`

  const handleExcel = () => {
    try {
      exportReportExcel(summary, detail, title)
    } catch {
      toast.error('ส่งออก Excel ไม่สำเร็จ')
    }
  }

  const donutData = ['ok', 'broken', 'disposal', 'unneeded', 'missing'].map((k) => ({
    label: STATUS[k].label,
    value: byStatus[k] || 0,
    color: STATUS[k].dot,
  }))
  const max = Math.max(1, ...byRoom.map((r) => r.count))
  const brokenAll = (byStatus.broken || 0) + (byStatus.disposal || 0)

  return (
    <div className="space-y-5 print:space-y-3 print:text-black">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h2 className="font-semibold mr-auto">รายงานสรุปครุภัณฑ์</h2>
        <select value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
          <option value="">ทุกงบประมาณ</option>
          {budgets.map((b) => (
            <option key={b.abbr} value={b.name}>{b.name}{b.active ? '' : ' (งบเดิม)'}</option>
          ))}
        </select>
        <Btn onClick={handleExcel}>
          <Icon name="down" /> ส่งออก Excel
        </Btn>
        <Btn variant="primary" onClick={() => window.print()}>
          <Icon name="down" /> พิมพ์ / บันทึก PDF
        </Btn>
      </div>

      {/* หัวรายงาน — แสดงเฉพาะตอนพิมพ์ */}
      <div className="hidden print:block text-center">
        <p className="text-[16px] font-bold">{title}</p>
        <p className="text-[12px]">ข้อมูล ณ วันที่ {formatDateTH(summary.generatedAt)}</p>
      </div>

      <div className="grid gap-4 grid-cols-2 xl:grid-cols-5 print:hidden">
        <StatCard label="ทั้งหมด (ไม่รวมตัดโอน)" value={total} sub={`ตัดโอนแล้ว ${nf(summary.transferred)} รายการ`} />
        <StatCard label="ปกติ" value={byStatus.ok || 0} sub={`${pct(byStatus.ok, total)}%`} color="var(--ok)" />
        <StatCard label="ชำรุด" value={brokenAll} sub={`ซ่อมได้ ${nf(byStatus.broken)} · ซ่อมไม่ได้ ${nf(byStatus.disposal)}`} color="var(--bad)" />
        <StatCard label="หมดความจำเป็น" value={byStatus.unneeded || 0} sub={`${pct(byStatus.unneeded, total)}%`} color="var(--warn)" />
        <StatCard label="ไม่พบพัสดุ" value={byStatus.missing || 0} sub={`${pct(byStatus.missing, total)}%`} color="var(--gone)" />
      </div>

      {inspection && (
        <Card className="p-4 text-[13px] print:hidden">
          รอบตรวจนับล่าสุด ปีงบประมาณ {inspection.budgetYear} ({inspection.status === 'open' ? 'กำลังดำเนินการ' : `ปิดแล้ว ${formatDateTH(inspection.closedAt)}${inspection.closedBy ? ` โดย ${inspection.closedBy}` : ''}`})
          {inspection.closeReason && <span className="block text-[12px] text-warn mt-1">ปิดแทนผู้เปิดรอบ — เหตุผล: {inspection.closeReason}</span>}
          · ตรวจแล้ว {nf(inspection.progress.checked)} จาก {nf(inspection.progress.total)} รายการ ({inspection.progress.percent}%)
        </Card>
      )}

      <Card className="p-4 print:shadow-none print:border-0 print:p-0">
        <h3 className="font-semibold mb-3">สรุปจำนวนครุภัณฑ์แยกตามงบประมาณและสถานะ</h3>
        <div className="scroll-x">
          <table className="w-full min-w-[760px] text-[13px] print:text-[11px] print:min-w-0 border-collapse">
            <thead>
              <tr className="text-[12px] text-muted border-b border-line print:text-black">
                <th className="text-left font-medium py-2 pr-3">งบประมาณ</th>
                {SUMMARY_COLUMNS.map((c) => (
                  <th key={c.key} className={`text-right font-medium py-2 px-2 ${c.key === 'transferred' ? 'text-faint' : ''}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.budget} className="border-b border-line">
                  <td className="py-2 pr-3">
                    {g.budget} {!g.active && <span className="text-[11px] text-faint">(งบเดิม)</span>}
                  </td>
                  {SUMMARY_COLUMNS.map((c) => (
                    <td key={c.key} className={`py-2 px-2 text-right tabular-nums ${c.key === 'total' ? 'font-semibold' : ''} ${c.key === 'transferred' ? 'text-faint' : ''}`}>
                      {nf(g[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 pr-3">รวมทั้งหมด</td>
                {SUMMARY_COLUMNS.map((c) => (
                  <td key={c.key} className={`py-2 px-2 text-right tabular-nums ${c.key === 'transferred' ? 'text-faint' : ''}`}>{nf(totals[c.key])}</td>
                ))}
              </tr>
            </tbody>
          </table>
          {groups.length === 0 && <p className="py-6 text-center text-muted">ไม่มีข้อมูล</p>}
        </div>
        <p className="text-[11px] text-faint mt-2">
          * “รวม” ไม่นับครุภัณฑ์ที่ตัดโอนให้หน่วยงานอื่นแล้ว · งบเดิมคืองบในอดีตที่ยังมีครุภัณฑ์คงเหลือ
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3 print:hidden">
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
          <h3 className="font-semibold mb-3">จำนวนตามสถานที่ (10 อันดับแรก)</h3>
          {byRoom.length ? <RoomBars data={byRoom} max={max} /> : <p className="text-[13px] text-muted">ไม่มีข้อมูล</p>}
        </Card>
      </div>

      <Card className="p-4 print:shadow-none print:border-0 print:p-0 print:break-before-page">
        <h3 className="font-semibold mb-3">ตารางรายละเอียดทั้งหมด ({nf(detail.items.length)} รายการ)</h3>
        <div className="scroll-x">
          <table className="w-full min-w-[900px] text-[13px] print:text-[10px] print:min-w-0">
            <thead>
              <tr className="text-[12px] text-muted border-b border-line print:text-black">
                {['ลำดับ', 'เลขครุภัณฑ์', 'ชื่อสินทรัพย์', 'งบประมาณ', 'สถานที่', 'ผู้ถือครอง', 'สถานะ', 'ตรวจล่าสุด'].map((h) => (
                  <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detail.items.map((r, i) => (
                <tr
                  key={r.id}
                  className={`border-b border-line last:border-0 break-inside-avoid ${i >= DETAIL_SCREEN_LIMIT ? 'hidden print:table-row' : ''}`}
                >
                  <td className="py-2 pr-3 text-faint tabular-nums">{i + 1}</td>
                  <td className="py-2 pr-3 font-mono text-[12px] tabular-nums whitespace-nowrap">{r.code}</td>
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3 text-muted">{r.budget}</td>
                  <td className="py-2 pr-3 text-muted">{r.room}</td>
                  <td className="py-2 pr-3 text-muted">{r.owner || '—'}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">{STATUS[r.status]?.label || r.status}</td>
                  <td className="py-2 pr-3 text-muted whitespace-nowrap">{r.lastInspectedAt ? formatDateTH(r.lastInspectedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {detail.items.length === 0 && <p className="py-8 text-center text-muted">ไม่มีข้อมูล</p>}
          {detail.items.length > DETAIL_SCREEN_LIMIT && (
            <p className="text-[12px] text-faint text-center pt-3 print:hidden">
              แสดงบนหน้าจอ {DETAIL_SCREEN_LIMIT} รายการแรก — ไฟล์ Excel และการพิมพ์มีครบทุกรายการ
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
