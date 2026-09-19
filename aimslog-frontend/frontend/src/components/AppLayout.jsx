import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { ConfirmDialog, useToast } from './UI'
import { TITLES } from '../data/titles'
import { useAuth } from '../hooks/useAuth'

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const { logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const titleKey = Object.keys(TITLES).find((k) => location.pathname.includes(k))
  const title = TITLES[titleKey] || 'AIMSlog'

  const toggleTheme = () => {
    const attr = document.documentElement.getAttribute('data-theme')
    const isDark = attr === 'dark' || (!attr && window.matchMedia('(prefers-color-scheme: dark)').matches)
    const next = isDark ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('aimslog.theme', next)
    } catch {
      /* เบราว์เซอร์บางโหมดอาจปิด storage ไว้ ไม่ใช่เรื่องคอขาดบาดตาย ข้ามไปได้ */
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      await logout()
      toast.info('ออกจากระบบเรียบร้อยแล้ว')
      navigate('/login', { replace: true })
    } catch {
      toast.error('ออกจากระบบไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setLoggingOut(false)
      setConfirmLogout(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar open={menuOpen} setOpen={setMenuOpen} onLogoutClick={() => setConfirmLogout(true)} />

      <main className="flex-1 min-w-0 p-4 sm:p-6">
        <Topbar title={title} onMenu={() => setMenuOpen(true)} onToggleTheme={toggleTheme} />
        <Outlet />
      </main>

      <ConfirmDialog
        open={confirmLogout}
        title="ออกจากระบบ"
        message="ยืนยันออกจากระบบหรือไม่? งานที่ยังไม่บันทึกจะหายไป"
        confirmLabel="ออกจากระบบ"
        danger
        loading={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  )
}
