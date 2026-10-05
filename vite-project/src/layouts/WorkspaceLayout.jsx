import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import api from '../services/api'

const navigation = [
  { to: '/', label: 'ภาพรวม', code: '00', adminOnly: false },
  { to: '/assets', label: 'ครุภัณฑ์', code: '01', adminOnly: false },
  { to: '/imports', label: 'นำเข้า Excel', code: '02', adminOnly: true },
  { to: '/inspections', label: 'ตรวจนับ', code: '03', adminOnly: false },
  { to: '/reports', label: 'รายงาน', code: '04', adminOnly: false },
  { to: '/users', label: 'ผู้ใช้', code: '05', adminOnly: true },
]

const pageTitles = {
  '/': 'ภาพรวมครุภัณฑ์',
  '/assets': 'ทะเบียนครุภัณฑ์',
  '/imports': 'นำเข้าข้อมูล Excel',
  '/inspections': 'ระบบตรวจนับครุภัณฑ์',
  '/reports': 'รายงานและส่งออก',
  '/users': 'จัดการผู้ใช้',
}

export default function WorkspaceLayout({ session, onLogout }) {
  const [health, setHealth] = useState('checking')
  const location = useLocation()
  const isAdmin = session.user.role === 'admin'

  useEffect(() => {
    let active = true
    api.get('/health')
      .then(({ data }) => { if (active) setHealth(data.database) })
      .catch(() => { if (active) setHealth('disconnected') })
    return () => { active = false }
  }, [location.pathname])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><span className="brand-mark" aria-hidden="true">A</span><span>AIMSlog</span></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="เมนูหลัก">
          {navigation.filter((item) => !item.adminOnly || isAdmin).map((item) => <NavLink className={({ isActive }) => `side-nav-link ${isActive ? 'side-nav-link-active' : ''}`} end={item.to === '/'} key={item.to} to={item.to}>
            <span className="side-icon">{item.code}</span><span>{item.label}</span><span className="side-chevron">›</span>
          </NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-line"><span className={`online-dot ${health !== 'connected' ? 'offline-dot' : ''}`} />
            <span>{health === 'connected' ? 'Backend connected' : health === 'checking' ? 'กำลังเชื่อมต่อ...' : 'Backend offline'}</span>
          </div>
          <div className="profile-block">
            <div className="avatar">{session.user.name?.slice(0, 1) || 'U'}</div>
            <div className="profile-copy"><strong>{session.user.name}</strong><span>{isAdmin ? 'ผู้ดูแลระบบ' : 'กรรมการตรวจนับ'}</span></div>
            <button className="icon-button logout-button" onClick={onLogout} title="ออกจากระบบ" type="button">↗</button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div><p className="eyebrow">AIMSLOG / ASSET OPERATIONS</p><h1>{pageTitles[location.pathname] || 'AIMSlog'}</h1></div>
        </header>
        <Outlet />
      </main>
    </div>
  )
}