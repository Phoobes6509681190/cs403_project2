import * as XLSX from 'xlsx'
import { STATUS } from '../data/statusConfig'
import { formatDateTH } from './format'

// คอลัมน์หน้าสรุป: 4 กลุ่มตามที่เจ้าหน้าที่พัสดุใช้ (ชำรุดแยกซ่อมได้/ซ่อมไม่ได้) + ตัดโอนแยกไม่นับรวม
export const SUMMARY_COLUMNS = [
  { key: 'ok', label: 'ปกติ' },
  { key: 'broken', label: 'ชำรุด (ซ่อมได้)' },
  { key: 'disposal', label: 'ชำรุด (ซ่อมไม่ได้/รอจำหน่าย)' },
  { key: 'unneeded', label: 'หมดความจำเป็น' },
  { key: 'missing', label: 'ไม่พบพัสดุตามทะเบียน' },
  { key: 'total', label: 'รวม' },
  { key: 'transferred', label: 'ตัดโอน (ไม่นับรวม)' },
]

const buddhistYear = (y) => (y ? (y < 100 ? 2500 + y : y) : '')

export function exportReportExcel(summary, detail, title) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: สรุป
  const head = ['งบประมาณ', ...SUMMARY_COLUMNS.map((c) => c.label)]
  const rows = summary.groups.map((g) => [g.budget + (g.active ? '' : ' (งบเดิม)'), ...SUMMARY_COLUMNS.map((c) => g[c.key] || 0)])
  const totalRow = ['รวมทั้งหมด', ...SUMMARY_COLUMNS.map((c) => summary.totals[c.key] || 0)]
  const ws1 = XLSX.utils.aoa_to_sheet([[title], [`ข้อมูล ณ ${formatDateTH(summary.generatedAt)}`], [], head, ...rows, totalRow])
  ws1['!cols'] = head.map((h, i) => ({ wch: i === 0 ? 28 : Math.max(10, h.length + 2) }))
  XLSX.utils.book_append_sheet(wb, ws1, 'สรุป')

  // Sheet 2: รายละเอียด
  const dHead = ['ลำดับ', 'เลขครุภัณฑ์', 'ชื่อสินทรัพย์', 'ยี่ห้อ', 'งบประมาณ', 'ปีงบที่ซื้อ', 'สถานที่', 'ผู้ถือครอง', 'สถานะ', 'ตรวจนับล่าสุด']
  const dRows = detail.items.map((a, i) => [
    i + 1, a.code, a.name, a.brand, a.budget, buddhistYear(a.codeParts?.year), a.room, a.owner,
    STATUS[a.status]?.label || a.status, a.lastInspectedAt ? formatDateTH(a.lastInspectedAt) : '',
  ])
  const ws2 = XLSX.utils.aoa_to_sheet([dHead, ...dRows])
  ws2['!cols'] = [6, 20, 40, 12, 22, 10, 24, 20, 16, 14].map((wch) => ({ wch }))
  ws2['!autofilter'] = { ref: `A1:J${dRows.length + 1}` }
  XLSX.utils.book_append_sheet(wb, ws2, 'รายละเอียด')

  const date = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `aimslog-report-${date}.xlsx`)
}
