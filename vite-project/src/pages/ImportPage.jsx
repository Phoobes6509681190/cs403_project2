import { useState } from 'react'
import api from '../services/api'

const statusOptions = [
  ['normal', 'ปกติ'],
  ['damaged', 'ชำรุด'],
  ['lost', 'สูญหาย'],
  ['disposed', 'จำหน่ายแล้ว'],
]

function downloadBlob(data, filename) {
  const url = URL.createObjectURL(data)
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

export default function ImportPage() {
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [statusMappings, setStatusMappings] = useState({})
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function downloadTemplate() {
    setError('')
    try {
      const { data } = await api.get('/assets/import/template', { responseType: 'blob' })
      downloadBlob(data, 'aimslog-import-template.xlsx')
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'ดาวน์โหลด template ไม่สำเร็จ')
    }
  }

  async function previewFile(event) {
    event.preventDefault()
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    setRows([])
    const formData = new FormData()
    formData.append('file', file)
    try {
      const { data } = await api.post('/assets/import/preview', formData)
      setRows(data.rows || [])
      setStatusMappings(Object.fromEntries((data.unmapped || []).map((row) => [String(row.row), ''])))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'อ่านไฟล์ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function confirmImport() {
    setBusy(true)
    setError('')
    try {
      const { data } = await api.post('/assets/import/confirm', { rows, statusMappings })
      setResult(data)
      if (data.importedCount > 0) setRows([])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'นำเข้าข้อมูลไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  function updateMapping(rowNumber, status) {
    setStatusMappings((current) => ({ ...current, [String(rowNumber)]: status }))
  }

  const missingMappings = rows.some((row) => !row.status && !statusMappings[String(row.row)])
  const blockedRows = rows.filter((row) => row.validationErrors?.length > 0).length

  return (
    <div className="page-stack">
      {error && <div className="notice error-notice" role="alert">{error}</div>}
      <section className="page-section import-intro">
        <div><p className="eyebrow">DATA MIGRATION / EXCEL</p><h2>นำเข้าครุภัณฑ์</h2><p>ตรวจสอบแถวและ map สถานะที่ไม่รู้จักก่อนยืนยันบันทึก</p></div>
        <button className="button button-quiet" onClick={downloadTemplate} type="button"><span aria-hidden="true">↓</span> ดาวน์โหลด template</button>
      </section>
      <section className="page-section import-upload-section">
        <form className="import-upload-form" onSubmit={previewFile}>
          <label className="file-picker" htmlFor="excel-file"><span className="file-icon" aria-hidden="true">XLSX</span><span><strong>{file?.name || 'เลือกไฟล์ Excel'}</strong><small>.xlsx · สูงสุด 10 MB</small></span><input accept=".xlsx" id="excel-file" onChange={(event) => { setFile(event.target.files?.[0] || null); setRows([]); setResult(null) }} type="file" /></label>
          <button className="button button-primary" disabled={!file || busy} type="submit">{busy ? 'กำลังอ่านไฟล์...' : 'แสดงตัวอย่าง'}</button>
        </form>
      </section>

      {rows.length > 0 && <section className="page-section import-preview-section">
        <div className="page-section-heading"><div><p className="eyebrow">PREVIEW / {rows.length} ROWS</p><h2>ตรวจสอบก่อนยืนยัน</h2></div><button className="button button-primary" disabled={busy || missingMappings || blockedRows === rows.length} onClick={confirmImport} type="button">ยืนยันนำเข้า {rows.length - blockedRows} แถว</button></div>
        {(missingMappings || blockedRows > 0) && <p className="import-warning" role="status">{missingMappings ? 'เลือกสถานะให้ครบทุกแถวที่ map ไม่ได้' : `มี ${blockedRows} แถวที่ข้อมูลไม่ครบหรือซ้ำ จะถูกข้ามเมื่อยืนยัน`}</p>}
        <div className="simple-table-wrap import-table-wrap"><table className="simple-table import-table"><thead><tr><th>แถว</th><th>รหัส</th><th>ชื่อ / ประเภท</th><th>สถานที่</th><th>สถานะเดิม</th><th>สถานะใหม่</th><th>ผลตรวจข้อมูล</th></tr></thead><tbody>
          {rows.map((row) => <tr className={row.validationErrors?.length ? 'import-row-error' : !row.status ? 'import-row-unmapped' : ''} key={row.row}>
            <td>{row.row}</td><td>{row.assetCode || '—'}{row.exists && <small className="existing-tag">มีในระบบ</small>}</td><td><strong>{row.name || '—'}</strong><small>{row.category || 'ไม่ระบุประเภท'}</small></td><td>{row.location || '—'}</td><td>{row.originalStatus || '—'}</td>
            <td>{row.status ? <span className="mapped-status">{statusOptions.find(([value]) => value === row.status)?.[1] || row.status}</span> : <select aria-label={`เลือกสถานะให้แถว ${row.row}`} onChange={(event) => updateMapping(row.row, event.target.value)} value={statusMappings[String(row.row)] || ''}><option value="">เลือกสถานะ</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}</td>
            <td>{row.validationErrors?.length ? <span className="row-errors">{row.validationErrors.join(', ')}</span> : row.status ? 'พร้อมนำเข้า' : 'ต้อง map สถานะ'}</td>
          </tr>)}
        </tbody></table></div>
      </section>}

      {result && <section className="page-section import-result-section" role="status"><div className="page-section-heading"><div><p className="eyebrow">IMPORT RESULT</p><h2>{result.success ? 'นำเข้าสำเร็จ' : 'นำเข้าเสร็จพร้อมรายการที่ต้องแก้'}</h2></div><span className="count-badge">{result.importedCount} รายการ</span></div>
        {result.errors?.length > 0 && <ul className="import-error-list">{result.errors.map((item, index) => <li key={`${item.row}-${index}`}>แถว {item.row} · {item.assetCode || 'ไม่มีรหัส'}: {item.message}</li>)}</ul>}
      </section>}
    </div>
  )
}