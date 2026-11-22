import { useState } from 'react'
import { STATUS } from '../data/statusConfig'
import { Btn, ConfirmDialog, StatusPill } from './UI'

// ผลตรวจที่เลือกได้ (ตรงกับ INSPECT_RESULTS ฝั่ง backend)
export const INSPECT_ACTIONS = ['ok', 'broken', 'unneeded', 'transferred', 'missing'].map((key) => ({ key }))
// ผลที่ต้องเขียนหมายเหตุ เช่น จำหน่ายเมื่อไหร่/เลขที่หนังสือ, หาไม่พบเพราะอะไร
export const NOTE_REQUIRED = ['transferred', 'missing']
const NOTE_HINT = {
  transferred: 'เช่น จำหน่ายตามหนังสือที่ ... ลงวันที่ ...',
  missing: 'เช่น ตรวจห้องแล้วไม่พบ / ผู้ถือครองย้ายไป ...',
}

// เลือกผลจาก dropdown -> (หมายเหตุ) -> กด "บันทึก" -> ยืนยันอีกครั้งในหน้าต่างที่สรุปสิ่งที่เลือก
// กันกดพลาดตอนเดินตรวจ (ตาม feedback UAT: ต้องกดบันทึกก่อนจึงนับว่าตรวจแล้ว)
export function InspectPicker({ current, currentNote = '', disabled, onSave, onCancel, assetLabel }) {
  const [status, setStatus] = useState(current || '')
  const [note, setNote] = useState(currentNote)
  const [confirm, setConfirm] = useState(false)
  const needNote = NOTE_REQUIRED.includes(status)
  const ready = status && (!needNote || note.trim())

  const save = async () => {
    await onSave(status, note.trim())
    setConfirm(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          disabled={disabled}
          aria-label="ผลการตรวจ"
          className="min-h-[44px] min-w-[180px] rounded-xl border border-line bg-surface px-3 text-[13px] focus:border-brand"
        >
          <option value="">— เลือกผลการตรวจ —</option>
          {INSPECT_ACTIONS.map((a) => (
            <option key={a.key} value={a.key}>{STATUS[a.key].label}</option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={disabled}
          placeholder={needNote ? `หมายเหตุ (จำเป็น) ${NOTE_HINT[status]}` : 'หมายเหตุ (ถ้ามี)'}
          className={`min-h-[44px] flex-1 min-w-[200px] rounded-xl border bg-surface px-3 text-[13px] placeholder:text-faint focus:border-brand ${
            needNote && !note.trim() ? 'border-warn' : 'border-line'
          }`}
        />
        <Btn variant="primary" disabled={disabled || !ready} onClick={() => setConfirm(true)} className="min-h-[44px]">
          บันทึก
        </Btn>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-[12px] text-muted hover:underline">ยกเลิก</button>
        )}
      </div>
      {needNote && !note.trim() && (
        <p className="text-[11px] text-warn">ผล "{STATUS[status].label}" ต้องระบุหมายเหตุก่อนบันทึก</p>
      )}

      <ConfirmDialog
        open={confirm}
        title="ยืนยันผลการตรวจ"
        message={assetLabel ? `ครุภัณฑ์: ${assetLabel}` : 'ตรวจสอบผลที่เลือกก่อนบันทึก'}
        confirmLabel="ยืนยันบันทึก"
        loading={disabled}
        onConfirm={save}
        onCancel={() => setConfirm(false)}
      >
        {status && (
          <div className="mt-3 rounded-xl border border-line bg-surface2 p-3 text-[13px] space-y-1.5">
            <p className="flex items-center gap-2">ผลการตรวจ: <StatusPill status={status} /></p>
            {current && current !== status && (
              <p className="text-[12px] text-warn">เปลี่ยนจากผลเดิม "{STATUS[current]?.label}"</p>
            )}
            <p>หมายเหตุ: <span className="text-muted">{note.trim() || '—'}</span></p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  )
}
