export const nf = (n) => Number(n ?? 0).toLocaleString('th-TH')
export const pct = (part, total) => (total ? ((part / total) * 100).toFixed(1) : '0.0')

export const currency = (n) =>
  Number(n ?? 0).toLocaleString('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 })

export const formatDateTH = (isoOrDate) => {
  if (!isoOrDate) return '—'
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export const formatDateTimeTH = (isoOrDate) => {
  if (!isoOrDate) return '—'
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
