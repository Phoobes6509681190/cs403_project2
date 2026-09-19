export const STATUS = {
  ok: { key: 'ok', label: 'ปกติ', dot: '#16a34a', cls: 'bg-oksoft text-ok' },
  broken: { key: 'broken', label: 'ชำรุด', dot: '#dc2626', cls: 'bg-badsoft text-bad' },
  repair: { key: 'repair', label: 'รอดำเนินการซ่อม', dot: '#ea580c', cls: 'bg-warnsoft text-warn' },
  missing: { key: 'missing', label: 'ไม่พบครุภัณฑ์', dot: '#64748b', cls: 'bg-gonesoft text-gone' },
}

export const STATUS_OPTIONS = Object.values(STATUS)
