import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import api from '../services/api'

const statusNames = { normal: 'ปกติ', damaged: 'ชำรุด', lost: 'สูญหาย', disposed: 'จำหน่ายแล้ว' }

export default function DashboardPage() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.get('/reports/summary')
      .then(({ data }) => { if (active) setSummary(data.summary) })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'โหลดข้อมูลสรุปไม่สำเร็จ') })
    return () => { active = false }
  }, [])

  const maxStatusCount = Math.max(1, ...(summary?.byStatus || []).map((row) => row.count))

  return (
    <div className="page-stack">
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <section className="metric-grid" aria-label="สรุปครุภัณฑ์">
        <article className="metric-panel metric-primary"><span className="eyebrow">ACTIVE ASSETS</span><strong>{summary?.totalAssets ?? '—'}</strong><span>รายการครุภัณฑ์ในระบบ</span></article>
        <article className="metric-panel"><span className="eyebrow">REGISTERED VALUE</span><strong>{summary ? summary.totalValue.toLocaleString('th-TH') : '—'}</strong><span>มูลค่ารวมตามราคาจัดซื้อ</span></article>
        <article className="metric-panel"><span className="eyebrow">STATUS GROUPS</span><strong>{summary?.byStatus?.length ?? '—'}</strong><span>สถานะที่มีรายการครุภัณฑ์</span></article>
      </section>
      <section className="dashboard-grid">
        <div className="page-section">
          <div className="page-section-heading"><div><p className="eyebrow">ASSET CONDITION</p><h2>สถานะครุภัณฑ์</h2></div><NavLink className="text-link" to="/assets">ดูรายการทั้งหมด <span aria-hidden="true">→</span></NavLink></div>
          {!summary ? <p className="empty-copy">กำลังโหลดข้อมูล...</p> : summary.byStatus.length === 0 ? <p className="empty-copy">ยังไม่มีข้อมูลครุภัณฑ์</p> : <div className="status-breakdown">
            {summary.byStatus.map((row) => <div className="status-breakdown-row" key={row.status}>
              <div><span>{statusNames[row.status] || row.status || 'ไม่ระบุ'}</span><strong>{row.count}</strong></div>
              <div className="mini-track"><span className={`bar-${row.status || 'unknown'}`} style={{ width: `${(row.count / maxStatusCount) * 100}%` }} /></div>
            </div>)}
          </div>}
        </div>
        <div className="page-section quick-actions">
          <p className="eyebrow">WORKFLOWS</p><h2>ทางลัด</h2>
          <NavLink to="/assets"><span className="action-index">01</span><span><strong>จัดการครุภัณฑ์</strong><small>ค้นหา เพิ่ม แก้ไข และดูประวัติ</small></span><span className="action-arrow">→</span></NavLink>
          <NavLink to="/imports"><span className="action-index">02</span><span><strong>นำเข้าจาก Excel</strong><small>ตรวจตัวอย่างและ map สถานะก่อนนำเข้า</small></span><span className="action-arrow">→</span></NavLink>
          <NavLink to="/inspections"><span className="action-index">03</span><span><strong>ตรวจนับประจำรอบ</strong><small>ติดตามผลและความคืบหน้าการตรวจ</small></span><span className="action-arrow">→</span></NavLink>
          <NavLink to="/reports"><span className="action-index">04</span><span><strong>รายงาน</strong><small>สรุปตามงบประมาณและส่งออกไฟล์</small></span><span className="action-arrow">→</span></NavLink>
        </div>
      </section>
    </div>
  )
}