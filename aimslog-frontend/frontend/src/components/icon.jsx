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

// โลโก้สาขาวิทยาการคอมพิวเตอร์ มธ. — พื้นขาวเสมอเพื่อให้อ่านออกทั้งธีมสว่างและมืด
export function DeptLogo({ className = 'h-10' }) {
  return (
    <span className="inline-flex items-center rounded-lg bg-white px-2 py-1 shrink-0">
      <img src="/cs-tu-logo.png" alt="Computer Science, Thammasat University" className={className} />
    </span>
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
