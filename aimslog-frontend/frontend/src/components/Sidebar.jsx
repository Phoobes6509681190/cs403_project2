import { Link, NavLink, useLocation } from 'react-router-dom'
import Icon, { DeptLogo } from './icon'
import { NAV } from '../data/nav'
import { RolePill, Avatar } from './UI'
import { useAuth } from '../hooks/useAuth'

export default function Sidebar({ open, setOpen, onLogoutClick }) {
  const { user, role } = useAuth()
  const visibleNav = NAV.filter((n) => n.roles.includes(role))
  // ไฮไลต์เมนูที่ path ตรงที่สุดเพียงอันเดียว (เช่น /assets/import ไม่ให้ "ครุภัณฑ์" ติดด้วย)
  const { pathname } = useLocation()
  const activeKey = visibleNav
    .filter((n) => pathname === n.path || pathname.startsWith(n.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0]?.key

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-surface border-r border-line
                    flex flex-col transition-transform lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-5 flex items-center gap-3">
          <DeptLogo className="h-9" />
          <div className="min-w-0">
            <p className="font-bold leading-tight">AIMSlog</p>
            <p className="text-[11px] text-faint truncate">ระบบครุภัณฑ์</p>
          </div>
        </div>

        <p className="px-6 pt-2 pb-2 text-[11px] text-faint tracking-wide">เมนู</p>

        <nav className="px-3 space-y-1">
          {visibleNav.map((n) => (
            <NavLink
              key={n.key}
              to={n.path}
              onClick={() => setOpen(false)}
              className={() =>
                `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-[13px] transition-colors
                 ${n.key === activeKey ? 'text-brandink font-semibold bg-brandsoft' : 'text-muted font-medium hover:bg-surface2 hover:text-ink'}`
              }
            >
              {() => (
                <>
                  <Icon name={n.icon} />
                  {n.label}
                  {n.key === activeKey && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-3 space-y-2">
          <div className="flex items-center gap-3 rounded-3xl border border-line px-3 py-2.5">
            <Avatar user={user} size={36} />
            <Link to="/profile" onClick={() => setOpen(false)} title="โปรไฟล์ / ตั้งค่า" className="min-w-0 flex-1 group">
              <p className="text-[13px] font-semibold leading-tight truncate group-hover:text-brand">{user?.name || user?.username}</p>
              <div className="mt-0.5">
                <RolePill role={role} />
              </div>
              <p className="text-[11px] text-faint group-hover:text-brand mt-0.5">โปรไฟล์และตั้งค่า</p>
            </Link>
            <button onClick={onLogoutClick} title="ออกจากระบบ" className="text-faint hover:text-bad p-1">
              <Icon name="out" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
