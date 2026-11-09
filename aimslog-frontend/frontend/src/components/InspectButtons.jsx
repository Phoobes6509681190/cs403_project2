import { STATUS } from '../data/statusConfig'

// ปุ่มผลตรวจขนาดใหญ่ (กดง่ายบนมือถือตอนเดินตรวจ)
export const INSPECT_ACTIONS = [
  { key: 'ok', cls: 'bg-ok text-white' },
  { key: 'broken', cls: 'bg-bad text-white' },
  { key: 'disposal', cls: 'bg-badsoft text-bad border border-bad/40' },
  { key: 'unneeded', cls: 'bg-warn text-white' },
  { key: 'missing', cls: 'bg-gone text-white' },
]

export function InspectButtons({ disabled, onPick, current }) {
  return (
    <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
      {INSPECT_ACTIONS.map((a) => (
        <button
          key={a.key}
          type="button"
          disabled={disabled}
          onClick={() => onPick(a.key)}
          className={`min-h-[44px] px-3 sm:px-4 rounded-xl text-[13px] font-semibold transition-opacity disabled:opacity-50 hover:opacity-90
            ${a.cls} ${current === a.key ? 'ring-2 ring-offset-2 ring-ink/60' : ''}`}
        >
          {STATUS[a.key].label}
        </button>
      ))}
    </div>
  )
}
