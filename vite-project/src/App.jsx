import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import api from './services/api'
import WorkspaceLayout from './layouts/WorkspaceLayout'
import AssetsPage from './pages/AssetsPage'
import DashboardPage from './pages/DashboardPage'
import ImportPage from './pages/ImportPage'
import ReportsPage from './pages/ReportsPage'
import UsersPage from './pages/UsersPage'
import './App.css'

const statusLabels = {
  draft: 'ฉบับร่าง',
  in_progress: 'กำลังตรวจ',
  closed: 'ปิดรอบแล้ว',
  normal: 'ปกติ',
  damaged: 'ชำรุด',
  lost: 'สูญหาย',
  disposed: 'จำหน่ายแล้ว',
}

const resultOptions = ['normal', 'damaged', 'lost', 'disposed']

function getErrorMessage(error) {
  return error.response?.data?.message || error.message || 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง'
}

function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('aimslog.session'))
    } catch {
      return null
    }
  })

  useEffect(() => {
    const clearExpiredSession = () => setSession(null)
    window.addEventListener('aimslog:unauthorized', clearExpiredSession)
    return () => window.removeEventListener('aimslog:unauthorized', clearExpiredSession)
  }, [])

  function handleLogin(loginResponse) {
    const nextSession = { token: loginResponse.token, user: loginResponse.user }
    localStorage.setItem('aimslog.session', JSON.stringify(nextSession))
    setSession(nextSession)
  }

  function handleLogout() {
    localStorage.removeItem('aimslog.session')
    setSession(null)
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage onLogin={handleLogin} />} />
        <Route element={session ? <WorkspaceLayout session={session} onLogout={handleLogout} /> : <Navigate to="/login" replace />}>
          <Route index element={<DashboardPage />} />
          <Route path="assets" element={<AssetsPage isAdmin={session?.user.role === 'admin'} />} />
          <Route path="imports" element={session?.user.role === 'admin' ? <ImportPage /> : <Navigate to="/" replace />} />
          <Route path="inspections" element={<InspectionPage session={session} />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="users" element={session?.user.role === 'admin' ? <UsersPage /> : <Navigate to="/" replace />} />
        </Route>
        <Route path="*" element={<Navigate to={session ? '/' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submitLogin(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const { data } = await api.post('/auth/login', { username, password })
      onLogin(data)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">A</span><span>AIMSlog</span></div>
        <p className="eyebrow">ASSET INSPECTION SYSTEM</p>
        <h1>เข้าสู่ระบบ</h1>
        <p className="login-copy">ลงชื่อเข้าใช้เพื่อจัดการรอบตรวจนับครุภัณฑ์</p>
        <form className="login-form" onSubmit={submitLogin}>
          <label htmlFor="username">ชื่อผู้ใช้</label>
          <input autoComplete="username" id="username" onChange={(event) => setUsername(event.target.value)} required value={username} />
          <label htmlFor="password">รหัสผ่าน</label>
          <input autoComplete="current-password" id="password" onChange={(event) => setPassword(event.target.value)} required type="password" value={password} />
          {error && <p className="notice error-notice" role="alert">{error}</p>}
          <button className="button button-primary login-submit" disabled={isSubmitting} type="submit">
            {isSubmitting ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
        <div className="login-footnote"><span className="online-dot" /> API พร้อมทดสอบผ่าน local backend</div>
      </section>
      <aside className="login-aside" aria-label="สรุประบบ">
        <div className="aside-rule" />
        <p className="eyebrow">INVENTORY CONTROL / 04</p>
        <p className="aside-title">ตรวจนับอย่างเป็นระบบ<br />ติดตามได้ทุกรายการ</p>
        <div className="aside-meta"><span>SPRINT 04</span><span>INSPECTION</span></div>
      </aside>
    </main>
  )
}

function InspectionPage({ session }) {
  const isAdmin = session.user.role === 'admin'
  const [inspections, setInspections] = useState([])
  const [assets, setAssets] = useState([])
  const [users, setUsers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [inspection, setInspection] = useState(null)
  const [progress, setProgress] = useState(null)
  const [resultDrafts, setResultDrafts] = useState({})
  const [committeeDraft, setCommitteeDraft] = useState([])
  const [roundName, setRoundName] = useState('')
  const [fiscalYear, setFiscalYear] = useState(String(new Date().getFullYear() + 543))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    async function loadWorkspace() {
      try {
        const inspectionResponse = await api.get('/inspections')
        if (!active) return
        const nextInspections = inspectionResponse.data.inspections || []
        setInspections(nextInspections)
        setSelectedId((current) => current || nextInspections[0]?._id || '')
        if (isAdmin) {
          const [userResponse, assetResponse] = await Promise.all([api.get('/users'), api.get('/assets')])
          if (!active) return
          setUsers(userResponse.data.users || [])
          setAssets(assetResponse.data.data || [])
        }
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError))
      }
    }
    loadWorkspace()
    return () => { active = false }
  }, [isAdmin])

  useEffect(() => {
    let active = true
    if (!selectedId) {
      return () => { active = false }
    }
    async function loadRound() {
      try {
        const [detailResponse, progressResponse] = await Promise.all([
          api.get(`/inspections/${selectedId}`),
          api.get(`/inspections/${selectedId}/progress`),
        ])
        if (!active) return
        const nextInspection = detailResponse.data.inspection
        setInspection(nextInspection)
        setProgress(progressResponse.data.progress)
        setCommitteeDraft((nextInspection.committee || []).map((member) => member._id || member))
        setResultDrafts(Object.fromEntries((nextInspection.items || [])
          .filter((item) => item.asset)
          .map((item) => [item.asset._id, { status: item.status || 'normal', note: item.note || '' }])))
      } catch (requestError) {
        if (active) setError(getErrorMessage(requestError))
      }
    }
    loadRound()
    return () => { active = false }
  }, [selectedId, revision])

  useEffect(() => {
    if (!selectedId || inspection?.status !== 'in_progress') return undefined
    let active = true
    const intervalId = window.setInterval(async () => {
      try {
        const { data } = await api.get(`/inspections/${selectedId}/progress`)
        if (active) setProgress(data.progress)
      } catch {
        if (active) setError('อัปเดตความคืบหน้าไม่สำเร็จ')
      }
    }, 5000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [selectedId, inspection?.status])

  async function reloadInspectionList(preferredId = selectedId) {
    const { data } = await api.get('/inspections')
    const nextInspections = data.inspections || []
    setInspections(nextInspections)
    const nextId = preferredId && nextInspections.some((item) => item._id === preferredId)
      ? preferredId
      : nextInspections[0]?._id || ''
    if (nextId !== selectedId) {
      setInspection(null)
      setProgress(null)
    }
    setSelectedId(nextId)
  }

  async function createRound(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { data } = await api.post('/inspections', { name: roundName, fiscalYear })
      setRoundName('')
      setNotice(`สร้างรอบตรวจแล้ว มีรายการครุภัณฑ์ ${data.inspection.items?.length ?? assets.length} รายการ`)
      await reloadInspectionList(data.inspection._id)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function assignCommittee(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.put(`/inspections/${selectedId}/committee`, { committee: committeeDraft })
      setNotice('บันทึกรายชื่อกรรมการแล้ว')
      setRevision((value) => value + 1)
      await reloadInspectionList(selectedId)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function saveResult(assetId) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.post(`/inspections/${selectedId}/items`, { assetId, ...resultDrafts[assetId] })
      setNotice('บันทึกผลตรวจแล้ว')
      setRevision((value) => value + 1)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function closeRound() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.put(`/inspections/${selectedId}/close`)
      setNotice('ปิดรอบตรวจเรียบร้อย')
      setRevision((value) => value + 1)
      await reloadInspectionList(selectedId)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function refreshWorkspace() {
    setError('')
    try {
      await reloadInspectionList()
      setRevision((value) => value + 1)
      const adminResponses = isAdmin ? await Promise.all([api.get('/users'), api.get('/assets')]) : null
      if (adminResponses) {
        setUsers(adminResponses[0].data.users || [])
        setAssets(adminResponses[1].data.data || [])
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    }
  }

  function updateResult(assetId, key, value) {
    setResultDrafts((current) => ({ ...current, [assetId]: { ...current[assetId], [key]: value } }))
  }

  function toggleCommittee(userId) {
    setCommitteeDraft((current) => current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId])
  }

  return (
    <div className="inspection-page">
        {(error || notice) && <div className={`notice ${error ? 'error-notice' : 'success-notice'}`} role={error ? 'alert' : 'status'}>
          <span>{error || notice}</span><button className="notice-dismiss" onClick={() => { setError(''); setNotice('') }} type="button" aria-label="ปิดข้อความ">×</button>
        </div>}

        <div className="inspection-toolbar"><p className="eyebrow">INSPECTION ROUNDS / LIVE DATA</p><button className="button button-quiet" onClick={refreshWorkspace} type="button"><span aria-hidden="true">↻</span> รีเฟรชข้อมูล</button></div>
        <div className="workspace-grid">
          <section className="round-column" aria-label="รายการรอบตรวจ">
            <div className="section-heading"><div><p className="eyebrow">INSPECTION ROUNDS</p><h2>รอบตรวจ</h2></div><span className="count-badge">{inspections.length}</span></div>
            <div className="round-list">
              {inspections.length === 0 && <p className="empty-copy">ยังไม่มีรอบตรวจ</p>}
              {inspections.map((round) => (
                <button aria-pressed={selectedId === round._id} className={`round-card ${selectedId === round._id ? 'round-card-active' : ''}`} key={round._id}
                  onClick={() => { setInspection(null); setProgress(null); setSelectedId(round._id); setError(''); setNotice('') }} type="button">
                  <span className={`status-marker status-${round.status}`} />
                  <span className="round-card-copy"><strong>{round.name}</strong><span>ปีงบประมาณ {round.fiscalYear}</span></span>
                  <span className={`status-label status-text-${round.status}`}>{statusLabels[round.status] || round.status}</span>
                </button>
              ))}
            </div>
            {isAdmin && <form className="create-round" onSubmit={createRound}>
              <p className="eyebrow">NEW ROUND</p>
              <label htmlFor="round-name">ชื่อรอบตรวจ</label>
              <input id="round-name" onChange={(event) => setRoundName(event.target.value)} placeholder="เช่น ตรวจนับประจำปี" required value={roundName} />
              <label htmlFor="fiscal-year">ปีงบประมาณ</label>
              <input id="fiscal-year" onChange={(event) => setFiscalYear(event.target.value)} required value={fiscalYear} />
              <button className="button button-primary full-button" disabled={busy} type="submit">+ สร้างรอบตรวจ</button>
              <p className="form-hint">บันทึกรายการครุภัณฑ์ปัจจุบันไว้ในรอบใหม่</p>
            </form>}
          </section>

          <section className="detail-column" aria-label="รายละเอียดรอบตรวจ">
            {!inspection ? <div className="empty-state"><span className="empty-symbol">04</span><h2>เลือกรอบตรวจ</h2><p>เลือกจากรายการด้านซ้าย หรือสร้างรอบใหม่เพื่อเริ่มทดสอบ</p></div> : <>
              <div className="detail-heading">
                <div><p className="eyebrow">ROUND / {inspection.fiscalYear}</p><h2>{inspection.name}</h2><p className="detail-subtitle">สร้างเมื่อ {new Date(inspection.createdAt).toLocaleDateString('th-TH')}</p></div>
                <span className={`large-status status-text-${inspection.status}`}><i className={`status-marker status-${inspection.status}`} />{statusLabels[inspection.status] || inspection.status}</span>
              </div>

              <div className="progress-section">
                <div className="progress-topline"><div><span className="eyebrow">INSPECTION PROGRESS</span><strong>{progress?.inspected ?? 0}<span> / {progress?.total ?? 0} รายการ</span></strong></div><strong className="progress-percent">{progress?.total ? progress.percentage : 0}%</strong></div>
                <div className="progress-track"><span style={{ width: `${progress?.total ? progress.percentage : 0}%` }} /></div>
                <div className="progress-legend"><span>คงเหลือ {progress?.remaining ?? 0} รายการ</span><span>{assets.length || progress?.total || 0} ครุภัณฑ์ในระบบ</span></div>
              </div>

              {isAdmin && inspection.status !== 'closed' && <form className="committee-section" onSubmit={assignCommittee}>
                <div className="section-heading compact-heading"><div><p className="eyebrow">ACCESS CONTROL</p><h3>กรรมการประจำรอบ</h3></div><button className="button button-outline" disabled={busy || committeeDraft.length === 0} type="submit">บันทึกกรรมการ</button></div>
                {users.length === 0 ? <p className="empty-copy">ไม่พบผู้ใช้สำหรับแต่งตั้งกรรมการ</p> : <div className="committee-list">
                  {users.map((user) => <label className="committee-option" key={user._id}>
                    <input checked={committeeDraft.includes(user._id)} onChange={() => toggleCommittee(user._id)} type="checkbox" />
                    <span className="committee-avatar">{user.name?.slice(0, 1) || 'U'}</span>
                    <span><strong>{user.name}</strong><small>{user.username} · {user.role}</small></span>
                  </label>)}
                </div>}
              </form>}

              <div className="items-section">
                <div className="section-heading compact-heading"><div><p className="eyebrow">ASSET REGISTER</p><h3>รายการตรวจนับ</h3></div><span className="count-badge">{inspection.items?.length || 0}</span></div>
                {!inspection.items?.length ? <div className="empty-items"><span>!</span><div><strong>รอบนี้ไม่มีรายการครุภัณฑ์</strong><p>รายการในรอบถูก snapshot ตอนสร้างรอบ ตรวจว่ามีครุภัณฑ์ก่อนสร้างรอบใหม่</p></div></div> : <div className="asset-table-wrap">
                  <table className="asset-table">
                    <thead><tr><th>รหัส / รายการ</th><th>ตำแหน่ง</th><th>ผลตรวจ</th><th>หมายเหตุ</th><th aria-label="บันทึก" /></tr></thead>
                    <tbody>{inspection.items.map((item) => {
                      const asset = item.asset
                      if (!asset) return null
                      const draft = resultDrafts[asset._id] || { status: 'normal', note: '' }
                      return <tr key={asset._id}>
                        <td><strong className="asset-name">{asset.name}</strong><span className="asset-code">{asset.assetCode} · {asset.category}</span></td>
                        <td className="asset-location">{asset.location || '—'}</td>
                        <td><select aria-label={`ผลตรวจ ${asset.assetCode}`} disabled={inspection.status !== 'in_progress'} onChange={(event) => updateResult(asset._id, 'status', event.target.value)} value={draft.status}>
                          {resultOptions.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                        </select></td>
                        <td><input aria-label={`หมายเหตุ ${asset.assetCode}`} className="note-input" disabled={inspection.status !== 'in_progress'} onChange={(event) => updateResult(asset._id, 'note', event.target.value)} placeholder="เพิ่มหมายเหตุ" value={draft.note} /></td>
                        <td><button className="save-item-button" disabled={busy || inspection.status !== 'in_progress'} onClick={() => saveResult(asset._id)} type="button">บันทึก</button></td>
                      </tr>
                    })}</tbody>
                  </table>
                </div>}
              </div>

              {isAdmin && inspection.status === 'in_progress' && <div className="close-row"><span>{progress?.total ? 'ปิดรอบได้เมื่อตรวจครบทุกรายการ' : 'เพิ่มครุภัณฑ์ก่อนสร้างรอบตรวจใหม่'}</span><button className="button button-danger" disabled={busy || !progress?.total} onClick={closeRound} type="button">ปิดรอบตรวจ</button></div>}
            </>}
          </section>
        </div>
    </div>
  )
}

export default App
