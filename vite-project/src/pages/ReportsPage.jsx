import { useEffect, useState } from 'react'
import api from '../services/api'

const statusLabels = { normal: 'ปกติ', damaged: 'ชำรุด', lost: 'สูญหาย', disposed: 'จำหน่ายแล้ว' }

function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  window.setTimeout(() => {
    link.remove()
    URL.revokeObjectURL(url)
  }, 1000)
}

export default function ReportsPage() {
  const [summary, setSummary] = useState(null)
  const [details, setDetails] = useState([])
  const [budgetOptions, setBudgetOptions] = useState([])
  const [filters, setFilters] = useState({ status: '', budgetSource: '', q: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([api.get('/reports/summary'), api.get('/reports/detail')])
      .then(([summaryResponse, detailResponse]) => {
        if (!active) return
        setSummary(summaryResponse.data.summary)
        setDetails(detailResponse.data.data || [])
        setBudgetOptions((summaryResponse.data.summary.byBudgetSource || []).map((item) => item.budgetSource).filter(Boolean))
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'โหลดรายงานไม่สำเร็จ') })
    return () => { active = false }
  }, [])

  async function applyFilters(event) {
    event.preventDefault()
    setError('')
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
      const { data } = await api.get('/reports/detail', { params })
      setDetails(data.data || [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'กรองรายงานไม่สำเร็จ')
    }
  }

  async function exportReport(format) {
    setBusy(true)
    setError('')
    try {
      const params = { ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)), format }
      const { data } = await api.get('/reports/export', { params, responseType: 'blob' })
      saveFile(data, `aimslog-assets.${format === 'excel' ? 'xlsx' : 'pdf'}`)
    } catch (requestError) {
      setError(requestError.response?.data?.message || `ส่งออก ${format} ไม่สำเร็จ`)
    } finally {
      setBusy(false)
    }
  }

  const maxBudgetCount = Math.max(1, ...(summary?.byBudgetSource || []).map((row) => row.count))

  return (
    <div className="page-stack">
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <section className="metric-grid report-metrics">
        <article className="metric-panel metric-primary"><span className="eyebrow">ASSETS</span><strong>{summary?.totalAssets ?? '—'}</strong><span>รายการที่ยังใช้งานในทะเบียน</span></article>
        <article className="metric-panel"><span className="eyebrow">TOTAL VALUE</span><strong>{summary ? `${summary.totalValue.toLocaleString('th-TH')} ฿` : '—'}</strong><span>รวมตามราคาครุภัณฑ์</span></article>
        <article className="metric-panel"><span className="eyebrow">BUDGET SOURCES</span><strong>{summary?.byBudgetSource?.length ?? '—'}</strong><span>แหล่งงบประมาณที่พบ</span></article>
      </section>

      <section className="report-summary-grid">
        <div className="page-section"><div className="page-section-heading"><div><p className="eyebrow">VALUE BY BUDGET</p><h2>แยกตามแหล่งงบ</h2></div></div>
          {!summary ? <p className="empty-copy">กำลังโหลด...</p> : <div className="budget-summary-list">{summary.byBudgetSource.map((item) => <div className="budget-summary-row" key={item.budgetSource}>
            <div><strong>{item.budgetSource}</strong><span>{item.count} รายการ · {item.value.toLocaleString('th-TH')} ฿</span></div><div className="mini-track"><span style={{ width: `${(item.count / maxBudgetCount) * 100}%` }} /></div>
          </div>)}{summary.byBudgetSource.length === 0 && <p className="empty-copy">ยังไม่มีข้อมูลแหล่งงบ</p>}</div>}
        </div>
        <div className="page-section"><div className="page-section-heading"><div><p className="eyebrow">ASSET STATUS</p><h2>แยกตามสถานะ</h2></div></div>
          {!summary ? <p className="empty-copy">กำลังโหลด...</p> : <div className="simple-table-wrap"><table className="simple-table"><thead><tr><th>สถานะ</th><th>จำนวน</th><th>มูลค่า</th></tr></thead><tbody>{summary.byStatus.map((item) => <tr key={item.status}><td>{statusLabels[item.status] || item.status || 'ไม่ระบุ'}</td><td>{item.count}</td><td>{item.value.toLocaleString('th-TH')} ฿</td></tr>)}</tbody></table></div>}
        </div>
      </section>

      <section className="page-section report-detail-section">
        <div className="page-section-heading"><div><p className="eyebrow">FULL REGISTER</p><h2>รายละเอียดครุภัณฑ์</h2></div><div className="heading-actions"><button className="button button-quiet" disabled={busy} onClick={() => exportReport('excel')} type="button">↓ Excel</button><button className="button button-quiet" disabled={busy} onClick={() => exportReport('pdf')} type="button">↓ PDF</button></div></div>
        <form className="report-filter-form" onSubmit={applyFilters}>
          <label htmlFor="report-q">ค้นหา<input id="report-q" onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value }))} placeholder="รหัสหรือชื่อครุภัณฑ์" value={filters.q} /></label>
          <label htmlFor="report-status">สถานะ<select id="report-status" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}><option value="">ทั้งหมด</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label htmlFor="report-budget">แหล่งงบ<select id="report-budget" onChange={(event) => setFilters((current) => ({ ...current, budgetSource: event.target.value }))} value={filters.budgetSource}><option value="">ทั้งหมด</option>{budgetOptions.map((budget) => <option key={budget} value={budget}>{budget}</option>)}</select></label>
          <button className="button button-primary" type="submit">กรองรายงาน</button>
          <span className="report-row-count">{details.length} รายการ</span>
        </form>
        <div className="simple-table-wrap report-table-wrap"><table className="simple-table asset-list-table"><thead><tr><th>รหัส / ชื่อ</th><th>ประเภท</th><th>สถานที่</th><th>แหล่งงบ</th><th>ราคา</th><th>สถานะ</th></tr></thead><tbody>
          {details.map((asset) => <tr key={asset._id}><td><strong>{asset.assetCode}</strong><small>{asset.name}</small></td><td>{asset.category}</td><td>{asset.location}</td><td>{asset.budgetSource || '—'}</td><td>{asset.price == null ? '—' : `${Number(asset.price).toLocaleString('th-TH')} ฿`}</td><td>{statusLabels[asset.status] || asset.status}</td></tr>)}
          {details.length === 0 && <tr><td className="table-empty" colSpan="6">ไม่มีข้อมูลตามตัวกรอง</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  )
}