import { ICONS, strokeProps, LOGO_PATH } from './icons'

export default function Icon({ name, className = 'w-4 h-4' }) {
  const shapes = ICONS[name] || []
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {shapes.map(({ tag: Tag, ...attrs }, i) => (
        <Tag key={i} {...attrs} {...strokeProps} />
      ))}
    </svg>
  )
}

export function Logo({ className = 'w-9 h-9' }) {
  return (
    <div className={`${className} rounded-xl bg-brand text-white grid place-items-center shrink-0`}>
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d={LOGO_PATH} />
      </svg>
    </div>
  )
}
