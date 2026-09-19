import { createContext, useCallback, useContext, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './icon'
import { STATUS } from '../data/statusConfig'
import { nf } from '../utils/format'

export function Card({ className = '', children }) {
  return (
    <section className={`bg-surface border border-line rounded-2xl shadow-card ${className}`}>{children}</section>
  )
}

export function Btn({ variant = 'ghost', className = '', children, disabled, ...rest }) {
  const base =
    'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const styles = {
    primary: 'bg-brand text-white hover:opacity-90',
    ghost: 'border border-line text-ink hover:bg-surface2',
    danger: 'bg-bad text-white hover:opacity-90',
  }
  return (
    <button className={`${base} ${styles[variant]} ${className}`} disabled={disabled} {...rest}>
      {children}
    </button>
  )
}

export function StatusPill({ status }) {
  const s = STATUS[status] || STATUS.missing
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
      {s.label}
    </span>
  )
}

export function RolePill({ role }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
        isAdmin ? 'bg-brandsoft text-brandink' : 'bg-surface2 text-muted'
      }`}
    >
      <Icon name="shield" className="w-3 h-3" />
      {isAdmin ? 'ผู้ดูแลระบบ' : 'ผู้ใช้งาน'}
    </span>
  )
}

export function Field({ label, required, hint, error, className = '', ...rest }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] text-muted">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      <input
        className={`mt-1.5 w-full rounded-xl border bg-surface px-3 py-2.5 text-ink placeholder:text-faint focus:border-brand ${
          error ? 'border-bad' : 'border-line'
        }`}
        {...rest}
      />
      {hint && !error && <p className="mt-1 text-[11px] text-faint">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-bad">{error}</p>}
    </label>
  )
}

export function SelectField({ label, required, options, className = '', ...rest }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[13px] text-muted">
        {label}
        {required && <span className="text-bad"> *</span>}
      </span>
      <select
        className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink focus:border-brand"
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function StatCard({ label, value, sub, color }) {
  return (
    <Card className="p-4">
      <p className="text-[12px] text-muted flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: color || 'var(--muted)' }} />
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold" style={{ color: color || 'var(--ink)' }}>
        {nf(value)}
      </p>
      <p className="text-[11px] text-faint">{sub}</p>
    </Card>
  )
}

export function ProgressBar({ value, max, label }) {
  const percent = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div>
      <div className="h-2.5 rounded-full bg-surface2 overflow-hidden">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${percent}%` }} />
      </div>
      {label !== false && <p className="mt-1.5 text-[12px] text-faint text-right">{label ?? `${percent}%`}</p>}
    </div>
  )
}

export function Spinner({ className = 'w-5 h-5' }) {
  return (
    <svg className={`${className} animate-spin text-brand`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4Z" />
    </svg>
  )
}

export function LoadingState({ label = 'กำลังโหลดข้อมูล...' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted">
      <Spinner />
      <p className="text-[13px]">{label}</p>
    </div>
  )
}

export function ErrorState({ message = 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="w-10 h-10 rounded-full bg-badsoft text-bad grid place-items-center">
        <Icon name="warning" className="w-5 h-5" />
      </span>
      <p className="text-[13px] text-bad max-w-sm">{message}</p>
      {onRetry && (
        <Btn onClick={onRetry} className="mt-1">
          ลองใหม่
        </Btn>
      )}
    </div>
  )
}

export function EmptyState({ message = 'ยังไม่มีข้อมูล' }) {
  return <div className="py-16 text-center text-muted text-[13px]">{message}</div>
}

/* ---------------- Modal ---------------- */

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} bg-surface border border-line rounded-2xl shadow-card`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-faint hover:text-ink p-1" aria-label="ปิด">
            <Icon name="x" />
          </button>
        </div>
        <div className="p-5 max-h-[70vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-line">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'ยืนยัน', danger, onConfirm, onCancel, loading }) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm"
      footer={
        <>
          <Btn onClick={onCancel} disabled={loading}>ยกเลิก</Btn>
          <Btn variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={loading}>
            {loading ? <Spinner className="w-4 h-4" /> : confirmLabel}
          </Btn>
        </>
      }
    >
      <p className="text-[13px] text-muted">{message}</p>
    </Modal>
  )
}

/* ---------------- Toast ---------------- */

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const push = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  const api = {
    success: (m) => push(m, 'success'),
    error: (m) => push(m, 'error'),
    info: (m) => push(m, 'info'),
  }

  const styles = {
    success: 'bg-oksoft text-ok border-ok/30',
    error: 'bg-badsoft text-bad border-bad/30',
    info: 'bg-brandsoft text-brandink border-brand/30',
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div className="fixed bottom-4 right-4 z-[60] space-y-2 w-full max-w-xs">
          {toasts.map((t) => (
            <div key={t.id} className={`rounded-xl border px-4 py-3 text-[13px] shadow-card ${styles[t.type]}`}>
              {t.message}
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast ต้องถูกเรียกภายใน <ToastProvider>')
  return ctx
}

/* ---------------- ชาร์ตเล็กๆ (SVG ล้วน ไม่พึ่งไลบรารีนอก) ---------------- */

export function RoomBars({ data, max }) {
  return (
    <div className="space-y-2.5">
      {data.map((r) => (
        <div key={r.room} className="flex items-center gap-3 text-[12px]">
          <span className="w-16 text-muted shrink-0">{r.room}</span>
          <div className="flex-1 h-2.5 rounded-full bg-surface2 overflow-hidden">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
          <span className="w-12 text-right tabular-nums text-muted">{nf(r.count)}</span>
        </div>
      ))}
    </div>
  )
}

export function Donut({ data, total }) {
  const R = 54
  const C = 2 * Math.PI * R
  let offset = 0

  return (
    <div className="relative w-[160px] h-[160px] shrink-0">
      <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--surface2)" strokeWidth="18" />
        {data.map((d) => {
          const len = total ? (d.value / total) * C : 0
          const el = (
            <circle
              key={d.label}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={d.color}
              strokeWidth="18"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-xl font-bold leading-tight">{nf(total)}</p>
          <p className="text-[11px] text-faint">รายการ</p>
        </div>
      </div>
    </div>
  )
}
