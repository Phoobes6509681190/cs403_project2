import Icon from './icon'

export default function Topbar({ title, onMenu, onToggleTheme }) {
  return (
    <header className="flex items-center gap-3 mb-5 pb-3 border-b border-line">
      <button className="lg:hidden p-2 -ml-1 rounded-lg border border-line" onClick={onMenu} aria-label="เปิดเมนู">
        <Icon name="menu" className="w-5 h-5" />
      </button>

      <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-lg border border-line text-muted hover:text-ink"
          title="สลับธีมสว่าง/มืด"
        >
          <Icon name="moon" />
        </button>
      </div>
    </header>
  )
}
