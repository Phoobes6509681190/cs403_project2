import { useLocation, useNavigate } from 'react-router-dom'
import Icon from './icon'

// หน้าก่อนหน้าแบบลำดับชั้น ใช้เมื่อเปิดลิงก์ตรง ๆ (ไม่มีประวัติให้ย้อน) เช่น สแกน QR เข้าหน้าครุภัณฑ์
const parentOf = (path) => {
  const parts = path.split('/').filter(Boolean)
  if (parts.length <= 1) return '/dashboard'
  return `/${parts.slice(0, -1).join('/')}`
}

export default function Topbar({ title, onMenu, onToggleTheme }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // ปุ่มย้อนกลับทุกหน้า ยกเว้นหน้าแรก (feedback UAT)
  const showBack = pathname !== '/dashboard' && pathname !== '/'
  const goBack = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
    else navigate(parentOf(pathname))
  }

  return (
    <header className="flex items-center gap-3 mb-6">
      <button className="lg:hidden p-2 -ml-1 rounded-full border border-line" onClick={onMenu} aria-label="เปิดเมนู">
        <Icon name="menu" className="w-5 h-5" />
      </button>

      {showBack && (
        <button
          onClick={goBack}
          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:text-ink hover:bg-surface2"
          aria-label="ย้อนกลับ"
          title="ย้อนกลับ"
        >
          <span aria-hidden="true">←</span>
          <span className="hidden sm:inline">ย้อนกลับ</span>
        </button>
      )}

      <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-full border border-line text-muted hover:text-ink"
          title="สลับธีมสว่าง/มืด"
        >
          <Icon name="moon" />
        </button>
      </div>
    </header>
  )
}
