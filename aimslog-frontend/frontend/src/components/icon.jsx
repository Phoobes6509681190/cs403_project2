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

// โลโก้สาขาวิทยาการคอมพิวเตอร์ มธ. — สีดำในธีมสว่าง / สีขาวในธีมมืด (สลับด้วย CSS ใน index.css)
export function DeptLogo({ className = 'h-10' }) {
  const alt = 'Computer Science, Thammasat University'
  return (
    <span className="inline-flex items-center shrink-0">
      <img src="/cs-tu-logo-black.png" alt={alt} className={`logo-light ${className}`} />
      <img src="/cs-tu-logo-white.png" alt={alt} className={`logo-dark ${className}`} />
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
