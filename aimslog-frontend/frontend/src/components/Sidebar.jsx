import { NavLink } from 'react-router-dom'
import Icon, { Logo } from './icon'
import { NAV } from '../data/nav'
import { RolePill } from './UI'
import { useAuth } from '../hooks/useAuth'

export default function Sidebar({ open, setOpen, onLogoutClick }) {
  const { user, role } = useAuth()
  const visibleNav = NAV.filter((n) => n.roles.includes(role))

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 bg-surface border-r border-line
                    flex flex-col transition-transform lg:translate-x-0
                    ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-5 flex items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <p className="font-bold leading-tight">AIMSlog</p>
            <p className="text-[11px] text-faint truncate">สาขาวิทยาการคอมพิวเตอร์</p>
          </div>
        </div>

        <p className="px-5 pb-2 text-[11px] text-faint">เมนูหลัก</p>

        <nav className="px-3 space-y-1">
          {visibleNav.map((n) => (
            <NavLink
              key={n.key}
              to={n.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors
                 ${isActive ? 'bg-brandsoft text-brandink' : 'text-muted hover:bg-surface2 hover:text-ink'}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={n.icon} />
                  {n.label}
                  {isActive && <span className="ml-auto w-1 h-5 rounded-full bg-brand" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-3 space-y-2">
          <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
            <span className="w-9 h-9 rounded-full bg-brandsoft text-brandink grid place-items-center text-[12px] font-bold">
              {(user?.name || user?.username || '?').slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-tight truncate">{user?.name || user?.username}</p>
              <div className="mt-0.5">
                <RolePill role={role} />
              </div>
            </div>
            <button onClick={onLogoutClick} title="ออกจากระบบ" className="text-faint hover:text-bad p-1">
              <Icon name="out" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
