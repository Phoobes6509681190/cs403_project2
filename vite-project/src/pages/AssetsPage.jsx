import { useEffect, useState } from 'react'
import api from '../services/api'

const statuses = [
  ['normal', 'ปกติ'],
  ['damaged', 'ชำรุด'],
  ['lost', 'สูญหาย'],
  ['disposed', 'จำหน่ายแล้ว'],
]

const emptyForm = {
  assetCode: '', name: '', category: '', location: '', budgetSource: '',
  purchaseDate: '', price: '', status: 'normal', responsiblePerson: '', description: '',
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('th-TH') : '—'
}

export default function AssetsPage({ isAdmin }) {
  const [assets, setAssets] = useState([])
  const [facets, setFacets] = useState([])
  const [filters, setFilters] = useState({ q: '', status: '', location: '', budgetSource: '', minPrice: '', maxPrice: '' })
  const [appliedFilters, setAppliedFilters] = useState({})
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [detail, setDetail] = useState(null)
  const [history, setHistory] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api.get('/assets')
      .then(({ data }) => {
        if (!active) return
        setAssets(data.data || [])
        setFacets(data.data || [])
      })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'โหลดครุภัณฑ์ไม่สำเร็จ') })
    return () => { active = false }
  }, [])

  async function loadAssets(params = appliedFilters) {
    const { data } = await api.get('/assets', { params })
    setAssets(data.data || [])
  }

  async function applyFilters(event) {
    event.preventDefault()
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''))
    setAppliedFilters(params)
    setError('')
    try {
      await loadAssets(params)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'กรองรายการไม่สำเร็จ')
    }
  }

  function clearFilters() {
    setFilters({ q: '', status: '', location: '', budgetSource: '', minPrice: '', maxPrice: '' })
    setAppliedFilters({})
    loadAssets({}).catch((requestError) => setError(requestError.response?.data?.message || 'โหลดครุภัณฑ์ไม่สำเร็จ'))
  }

  function openCreate() {
    setEditingId('')
    setForm(emptyForm)
    setEditorOpen(true)
  }

  function openEdit(asset) {
    setEditingId(asset._id)
    setForm({
      assetCode: asset.assetCode || '', name: asset.name || '', category: asset.category || '',
      location: asset.location || '', budgetSource: asset.budgetSource || '',
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().slice(0, 10) : '',
      price: asset.price ?? '', status: asset.status || 'normal',
      responsiblePerson: asset.responsiblePerson || '', description: asset.description || '',
    })
    setEditorOpen(true)
  }

  async function saveAsset(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    const payload = {
      ...form,
      price: form.price === '' ? undefined : Number(form.price),
      purchaseDate: form.purchaseDate || undefined,
    }
    try {
      if (editingId) await api.put(`/assets/${editingId}`, payload)
      else await api.post('/assets', payload)
      setEditorOpen(false)
      setNotice(editingId ? 'บันทึกการแก้ไขแล้ว' : 'เพิ่มครุภัณฑ์แล้ว')
      await loadAssets(appliedFilters)
      if (!appliedFilters.q && !appliedFilters.status && !appliedFilters.location && !appliedFilters.budgetSource) {
        const { data } = await api.get('/assets')
        setFacets(data.data || [])
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'บันทึกครุภัณฑ์ไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  async function deleteAsset(asset) {
    if (!window.confirm(`ซ่อนครุภัณฑ์ ${asset.assetCode} ใช่หรือไม่`)) return
    setError('')
    try {
      await api.delete(`/assets/${asset._id}`)
      setNotice('ซ่อนครุภัณฑ์แล้ว')
      await loadAssets(appliedFilters)
      setFacets((current) => current.filter((item) => item._id !== asset._id))
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'ลบครุภัณฑ์ไม่สำเร็จ')
    }
  }

  async function openDetails(asset) {
    setError('')
    try {
      const [detailResponse, historyResponse] = await Promise.all([
        api.get(`/assets/${asset._id}`),
        api.get(`/assets/${asset._id}/history`),
      ])
      setDetail(detailResponse.data.data)
      setHistory(historyResponse.data.data || [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'โหลดรายละเอียดไม่สำเร็จ')
    }
  }

  function updateFilter(event) {
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  function updateForm(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  }

  const locations = [...new Set(facets.map((asset) => asset.location).filter(Boolean))].sort()
  const budgets = [...new Set(facets.map((asset) => asset.budgetSource).filter(Boolean))].sort()

  return (
    <div className="page-stack">
      {(error || notice) && <div className={`notice ${error ? 'error-notice' : 'success-notice'}`} role={error ? 'alert' : 'status'}><span>{error || notice}</span><button className="notice-dismiss" onClick={() => { setError(''); setNotice('') }} type="button" aria-label="ปิดข้อความ">×</button></div>}
      <section className="asset-register page-section">
        <div className="page-section-heading"><div><p className="eyebrow">ASSET REGISTER</p><h2>รายการครุภัณฑ์</h2></div><div className="heading-actions"><span className="count-badge">{assets.length}</span>{isAdmin && <button className="button button-primary" onClick={openCreate} type="button">+ เพิ่มครุภัณฑ์</button>}</div></div>
        <form className="asset-filter-form" onSubmit={applyFilters}>
          <label className="keyword-field" htmlFor="asset-q"><span>ค้นหา</span><input id="asset-q" name="q" onChange={updateFilter} placeholder="รหัส ชื่อ ประเภท หรือผู้รับผิดชอบ" value={filters.q} /></label>
          <label htmlFor="asset-status"><span>สถานะ</span><select id="asset-status" name="status" onChange={updateFilter} value={filters.status}><option value="">ทั้งหมด</option>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label htmlFor="asset-location"><span>สถานที่</span><select id="asset-location" name="location" onChange={updateFilter} value={filters.location}><option value="">ทั้งหมด</option>{locations.map((location) => <option key={location} value={location}>{location}</option>)}</select></label>
          <label htmlFor="asset-budget"><span>แหล่งงบ</span><select id="asset-budget" name="budgetSource" onChange={updateFilter} value={filters.budgetSource}><option value="">ทั้งหมด</option>{budgets.map((budget) => <option key={budget} value={budget}>{budget}</option>)}</select></label>
          <label htmlFor="asset-min"><span>ราคาต่ำสุด</span><input id="asset-min" min="0" name="minPrice" onChange={updateFilter} placeholder="บาท" type="number" value={filters.minPrice} /></label>
          <label htmlFor="asset-max"><span>ราคาสูงสุด</span><input id="asset-max" min="0" name="maxPrice" onChange={updateFilter} placeholder="บาท" type="number" value={filters.maxPrice} /></label>
          <div className="filter-actions"><button className="button button-primary" type="submit">กรอง</button><button className="button button-quiet" onClick={clearFilters} type="button">ล้าง</button></div>
        </form>
        <div className="simple-table-wrap asset-table-list-wrap"><table className="simple-table asset-list-table"><thead><tr><th>รหัส / ชื่อ</th><th>ประเภท</th><th>สถานที่</th><th>แหล่งงบ</th><th>ราคา</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>
          {assets.map((asset) => <tr key={asset._id}>
            <td><strong>{asset.assetCode}</strong><small>{asset.name}</small></td><td>{asset.category}</td><td>{asset.location}</td><td>{asset.budgetSource || '—'}</td><td>{asset.price == null ? '—' : `${Number(asset.price).toLocaleString('th-TH')} ฿`}</td>
            <td><span className={`asset-status asset-status-${asset.status}`}>{statuses.find(([value]) => value === asset.status)?.[1] || asset.status}</span></td>
            <td><div className="row-actions"><button className="table-action" onClick={() => openDetails(asset)} type="button">รายละเอียด / ประวัติ</button>{isAdmin && <><button className="table-action" onClick={() => openEdit(asset)} type="button">แก้ไข</button><button className="table-action table-action-danger" onClick={() => deleteAsset(asset)} type="button">ซ่อน</button></>}</div></td>
          </tr>)}
          {assets.length === 0 && <tr><td className="table-empty" colSpan="7">ไม่พบครุภัณฑ์ที่ตรงกับตัวกรอง</td></tr>}
        </tbody></table></div>
      </section>

      {editorOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false) }}>
        <section aria-labelledby="asset-editor-title" aria-modal="true" className="modal-panel" role="dialog">
          <div className="page-section-heading"><div><p className="eyebrow">ASSET RECORD</p><h2 id="asset-editor-title">{editingId ? 'แก้ไขครุภัณฑ์' : 'เพิ่มครุภัณฑ์'}</h2></div><button aria-label="ปิด" className="modal-close" onClick={() => setEditorOpen(false)} type="button">×</button></div>
          <form className="asset-editor-form" onSubmit={saveAsset}>
            <label>รหัสครุภัณฑ์<input name="assetCode" onChange={updateForm} required value={form.assetCode} /></label>
            <label>ชื่อครุภัณฑ์<input name="name" onChange={updateForm} required value={form.name} /></label>
            <label>ประเภท<input name="category" onChange={updateForm} required value={form.category} /></label>
            <label>สถานที่<input name="location" onChange={updateForm} required value={form.location} /></label>
            <label>แหล่งงบประมาณ<input name="budgetSource" onChange={updateForm} value={form.budgetSource} /></label>
            <label>ราคา<input min="0" name="price" onChange={updateForm} type="number" value={form.price} /></label>
            <label>วันที่จัดซื้อ<input name="purchaseDate" onChange={updateForm} type="date" value={form.purchaseDate} /></label>
            <label>สถานะ<select name="status" onChange={updateForm} value={form.status}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>ผู้รับผิดชอบ<input name="responsiblePerson" onChange={updateForm} value={form.responsiblePerson} /></label>
            <label className="wide-field">รายละเอียด<textarea name="description" onChange={updateForm} rows="3" value={form.description} /></label>
            <div className="modal-actions"><button className="button button-quiet" onClick={() => setEditorOpen(false)} type="button">ยกเลิก</button><button className="button button-primary" disabled={busy} type="submit">{busy ? 'กำลังบันทึก...' : 'บันทึก'}</button></div>
          </form>
        </section>
      </div>}

      {detail && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetail(null) }}>
        <section aria-labelledby="asset-detail-title" aria-modal="true" className="modal-panel asset-detail-modal" role="dialog">
          <div className="page-section-heading"><div><p className="eyebrow">ASSET / {detail.assetCode}</p><h2 id="asset-detail-title">{detail.name}</h2></div><button aria-label="ปิด" className="modal-close" onClick={() => setDetail(null)} type="button">×</button></div>
          <dl className="asset-detail-grid">
            <div><dt>ประเภท</dt><dd>{detail.category}</dd></div><div><dt>สถานที่</dt><dd>{detail.location}</dd></div>
            <div><dt>แหล่งงบ</dt><dd>{detail.budgetSource || '—'}</dd></div><div><dt>ราคา</dt><dd>{detail.price == null ? '—' : `${Number(detail.price).toLocaleString('th-TH')} ฿`}</dd></div>
            <div><dt>วันที่จัดซื้อ</dt><dd>{formatDate(detail.purchaseDate)}</dd></div><div><dt>ผู้รับผิดชอบ</dt><dd>{detail.responsiblePerson || '—'}</dd></div>
            <div><dt>สถานะ</dt><dd>{statuses.find(([value]) => value === detail.status)?.[1] || detail.status}</dd></div><div><dt>รายละเอียด</dt><dd>{detail.description || '—'}</dd></div>
          </dl>
          <div className="history-heading"><p className="eyebrow">CHANGE LOG</p><h3>ประวัติการเปลี่ยนแปลง</h3></div>
          {history.length === 0 ? <p className="empty-copy">ยังไม่มีประวัติการเปลี่ยนแปลง</p> : <div className="history-list">{history.map((entry) => <article className="history-entry" key={entry._id}>
            <div className="history-meta"><strong>{entry.changedBy}</strong><time>{formatDate(entry.createdAt)}</time></div>
            {entry.changes.map((change, index) => <p key={`${entry._id}-${index}`}><span>{change.field}</span> {String(change.oldValue ?? '—')} <b>→</b> {String(change.newValue ?? '—')}</p>)}
          </article>)}</div>}
        </section>
      </div>}
    </div>
  )
}