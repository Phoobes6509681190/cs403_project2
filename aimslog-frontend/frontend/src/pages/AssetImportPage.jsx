import { useState } from 'react'
import { Link } from 'react-router-dom'
import Icon from '../components/icon'
import { Card, Btn, SelectField, LoadingState, StatusPill, useToast } from '../components/UI'
import { previewImport, commitImport, downloadImportTemplate } from '../services/assetService'
import { STATUS_OPTIONS } from '../data/statusConfig'
import { nf } from '../utils/format'

// ขั้นตอน: เลือกไฟล์ -> backend ตรวจไฟล์ (preview) -> Admin เลือกค่าที่ระบบไม่รู้จัก -> ยืนยันนำเข้า
export default function AssetImportPage() {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [statusMapping, setStatusMapping] = useState({}) // { 'ป้ายสถานะเดิม': 'statusKey' }
  const [budgetMapping, setBudgetMapping] = useState({}) // { 'ตัวย่อ': 'ชื่องบ' }
  const [showMissing, setShowMissing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  const reset = () => {
    setFile(null)
    setPreview(null)
    setStatusMapping({})
    setBudgetMapping({})
    setShowMissing(false)
    setResult(null)
  }

  const onFileChange = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = '' // ให้เลือกไฟล์เดิมซ้ำได้
    if (!f) return
    reset()
    setFile(f)
    setChecking(true)
    try {
      const data = await previewImport(f)
      setPreview(data)
      setStatusMapping(Object.fromEntries(data.unknownStatuses.map((s) => [s.label, ''])))
      setBudgetMapping(Object.fromEntries(data.unknownBudgets.map((b) => [b.abbr, ''])))
    } catch (err) {
      toast.error(err.response?.data?.message || 'อ่านไฟล์ไม่สำเร็จ ตรวจสอบว่าเป็นไฟล์ .xlsx หรือ .csv')
      reset()
    } finally {
      setChecking(false)
    }
  }

  const missingStatus = Object.values(statusMapping).some((v) => !v)
  const missingBudget = Object.values(budgetMapping).some((v) => !v.trim())
  const canImport = preview && (preview.newRows > 0 || preview.changedTotal > 0) && !missingStatus && !missingBudget

  const confirmImport = async () => {
    setImporting(true)
    try {
      const data = await commitImport(file, { statusMapping, budgetMapping })
      setResult(data)
      toast.success(`เพิ่มใหม่ ${nf(data.successCount)} · อัปเดต ${nf(data.updatedCount)} รายการ`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'นำเข้าข้อมูลไม่สำเร็จ')
    } finally {
      setImporting(false)
    }
  }

  const onTemplate = async () => {
    try {
      await downloadImportTemplate()
    } catch {
      toast.error('ดาวน์โหลด Template ไม่สำเร็จ')
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold mb-1">นำเข้าครุภัณฑ์จาก Excel</h2>
            <p className="text-[12px] text-muted">
              ใช้ไฟล์จากคณะได้เลย ระบบหาแถวหัวตารางเอง ต้องมีคอลัมน์ “รหัสสินทรัพย์อ้างอิง” และ “ชื่อสินทรัพย์”
              <br />
              ระบบเทียบกับข้อมูลเดิมให้ดูก่อนยืนยัน — นำเข้าแล้วข้อมูลในระบบจะตรงกับไฟล์ ส่วนค่าเดิมเก็บไว้ในประวัติของครุภัณฑ์
            </p>
          </div>
          <Btn onClick={onTemplate}>
            <Icon name="download" /> ดาวน์โหลด Template
          </Btn>
        </div>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:bg-surface2">
          <Icon name="upload" className="w-6 h-6 text-faint" />
          <span className="text-[13px] text-muted">{file ? file.name : 'คลิกเพื่อเลือกไฟล์ (.xlsx .xls .csv)'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
        </label>
      </Card>

      {checking && <LoadingState label="กำลังตรวจสอบไฟล์..." />}

      {preview && !result && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="รายการใหม่" value={preview.newRows} tone="ok" />
            <Stat label="ตรงกับในระบบ" value={preview.sameRows} />
            <Stat label="จะอัปเดตตามไฟล์" value={preview.changedTotal} tone={preview.changedTotal ? 'warn' : undefined} />
            <Stat label="ข้อมูลไม่ครบ" value={preview.errors.length} tone={preview.errors.length ? 'bad' : undefined} />
          </div>

          {preview.unknownStatuses.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-warn">
                <Icon name="warning" className="w-4 h-4" /> พบสถานะที่ระบบไม่รู้จัก {preview.unknownStatuses.length} แบบ
              </h3>
              <p className="text-[12px] text-muted mb-3">เลือกว่าแต่ละค่าหมายถึงสถานะไหน (ค่าเดิมยังถูกเก็บไว้)</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {preview.unknownStatuses.map((s) => (
                  <SelectField
                    key={s.label}
                    label={`“${s.label}” (${nf(s.count)} รายการ)`}
                    required
                    value={statusMapping[s.label]}
                    onChange={(e) => setStatusMapping({ ...statusMapping, [s.label]: e.target.value })}
                    options={[{ value: '', label: '— เลือกสถานะ —' }, ...STATUS_OPTIONS.map((o) => ({ value: o.key, label: o.label }))]}
                  />
                ))}
              </div>
            </Card>
          )}

          {preview.unknownBudgets.length > 0 && (
            <Card className="p-4">
              <h3 className="font-semibold mb-1 flex items-center gap-2 text-warn">
                <Icon name="warning" className="w-4 h-4" /> พบตัวย่องบที่ระบบยังไม่รู้จัก {preview.unknownBudgets.length} แบบ
              </h3>
              <p className="text-[12px] text-muted mb-3">
                ระบุชื่องบของแต่ละตัวย่อ (เช่น งบคลัง, งบรายได้หน่วยงาน) — ระบบจะจำไว้ใช้ครั้งต่อไป และไม่แปลงงบเก่าเป็นงบใหม่
              </p>
              <datalist id="budget-names">
                {[...preview.budgets, 'งบคลัง', 'งบรายได้หน่วยงาน']
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .map((b) => <option key={b} value={b} />)}
              </datalist>
              <div className="grid sm:grid-cols-2 gap-3">
                {preview.unknownBudgets.map((b) => (
                  <label key={b.abbr} className="block">
                    <span className="text-[13px] text-muted">
                      ตัวย่อ “{b.abbr}” เช่น {b.example} ({nf(b.count)} รายการ)<span className="text-bad"> *</span>
                    </span>
                    <input
                      list="budget-names"
                      value={budgetMapping[b.abbr]}
                      onChange={(e) => setBudgetMapping({ ...budgetMapping, [b.abbr]: e.target.value })}
                      placeholder="พิมพ์หรือเลือกชื่องบ"
                      className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-ink placeholder:text-faint focus:border-brand"
                    />
                  </label>
                ))}
              </div>
            </Card>
          )}

          {(preview.unrecognizedCodes > 0 || preview.unknownColumns.length > 0) && (
            <Card className="p-4 text-[12px] text-muted space-y-1">
              {preview.unrecognizedCodes > 0 && (
                <p>• มี {nf(preview.unrecognizedCodes)} รายการที่รูปแบบเลขครุภัณฑ์อ่านไม่ได้ จะนำเข้าโดยงบเป็น “ไม่ระบุ”</p>
              )}
              {preview.unknownColumns.length > 0 && (
                <p>• คอลัมน์ที่ระบบไม่ได้ใช้ (แต่เก็บค่าไว้): {preview.unknownColumns.join(', ')}</p>
              )}
            </Card>
          )}


          {preview.missingTotal > 0 && (
            <Card className="p-4">
              <button onClick={() => setShowMissing((v) => !v)} className="w-full flex items-center gap-2 text-left">
                <h3 className="font-semibold flex-1">มีในระบบแต่ไม่อยู่ในไฟล์ ({nf(preview.missingTotal)} รายการ)</h3>
                <span className="text-[12px] text-brand">{showMissing ? 'ซ่อน' : 'ดูรายการ'}</span>
              </button>
              <p className="text-[12px] text-muted mt-1">
                ระบบไม่เปลี่ยนอะไรให้ — ควรตรวจว่าถูกโอน/จำหน่ายไปแล้วหรือไม่ (ถ้าไฟล์นี้มีเฉพาะบางห้อง รายการเหล่านี้อาจไม่ใช่ปัญหา)
              </p>
              {showMissing && (
                <ul className="mt-3 divide-y divide-line max-h-72 overflow-y-auto">
                  {preview.missing.map((a) => (
                    <li key={a.id} className="py-2 flex items-center gap-3 text-[12px]">
                      <span className="font-mono text-[11px] text-muted w-36 shrink-0">{a.code}</span>
                      <Link to={`/assets/${a.id}`} className="flex-1 hover:text-brand">{a.name}</Link>
                      <span className="text-faint">{a.room}</span>
                      <StatusPill status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}


          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h3 className="font-semibold">ข้อมูลในไฟล์ ({nf(preview.totalRows)} แถว)</h3>
              <div className="flex gap-2">
                <Btn onClick={reset} disabled={importing}>ยกเลิก</Btn>
                <Btn variant="primary" onClick={confirmImport} disabled={!canImport || importing}>
                  {importing ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า (เพิ่ม ${nf(preview.newRows)} · อัปเดต ${nf(preview.changedTotal)})`}
                </Btn>
              </div>
            </div>
            <p className="text-[12px] text-muted mb-3">
              หลังนำเข้า ข้อมูลในระบบจะตรงกับไฟล์นี้ · ช่องที่ <span className="text-warn font-medium">ไฮไลต์</span> คือค่าที่เปลี่ยนจากในระบบ
              (ค่าเดิมแสดงตัวเล็กด้านล่างและถูกเก็บในประวัติของครุภัณฑ์)
            </p>
            {(missingStatus || missingBudget) && (
              <p className="text-[12px] text-warn mb-2">กรุณาเลือกสถานะ/งบที่ระบบไม่รู้จักให้ครบก่อนนำเข้า</p>
            )}
            <div className="scroll-x max-h-[560px] overflow-y-auto">
              <table className="w-full min-w-[1100px] text-[12px]">
                <thead className="sticky top-0 bg-surface z-10">
                  <tr className="text-muted border-b border-line">
                    {['แถว', 'ตึก/อาคาร', 'ชั้น', 'ห้อง', 'ระบุ สถานที่ใช้งาน', 'สภาพ', 'รหัสสินทรัพย์อ้างอิง', 'ชื่อสินทรัพย์', 'ยี่ห้อ', 'ผู้ถือครอง', ''].map((h) => (
                      <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => {
                    const statusKey = r.statusKey || statusMapping[r.statusLabel]
                    const cell = (field, value, extra = '') => (
                      <td className={`py-2 pr-3 ${extra} ${r.was[field] !== undefined ? 'bg-warnsoft' : ''}`}>
                        <span className={r.was[field] !== undefined ? 'text-warn font-medium' : ''}>{value || '—'}</span>
                        {r.was[field] !== undefined && <span className="block text-[10px] text-faint line-through">{r.was[field]}</span>}
                      </td>
                    )
                    const tag = {
                      new: <span className="text-ok">ใหม่</span>,
                      changed: <span className="text-warn">อัปเดต</span>,
                      same: <span className="text-faint">ตรงกัน</span>,
                      dup: <span className="text-faint">ซ้ำในไฟล์</span>,
                      invalid: <span className="text-bad">{r.errors.join(', ')}</span>,
                    }[r.kind]
                    return (
                      <tr key={r.row} className={`border-b border-line last:border-0 ${r.kind === 'dup' || r.kind === 'invalid' ? 'opacity-50' : ''}`}>
                        <td className="py-2 pr-3 text-faint">{r.row}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{r.building}</td>
                        <td className="py-2 pr-3">{r.floor}</td>
                        <td className="py-2 pr-3">{r.room}</td>
                        {cell('location', r.locationLabel, 'whitespace-nowrap')}
                        <td className={`py-2 pr-3 ${r.was.status !== undefined ? 'bg-warnsoft' : ''}`}>
                          {statusKey ? <StatusPill status={statusKey} /> : <span className="text-warn">? {r.statusLabel}</span>}
                          {r.was.status !== undefined && <span className="block text-[10px] text-faint line-through mt-0.5">{r.was.status}</span>}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap font-mono text-[11px]">{r.code || '—'}</td>
                        <td className="py-2 pr-3">{r.name || '—'}</td>
                        {cell('brand', r.brand)}
                        {cell('holderName', r.holderName)}
                        <td className="py-2 pr-3 whitespace-nowrap">{tag}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {preview.totalRows > preview.rows.length && (
              <p className="text-[11px] text-faint mt-2">แสดง {nf(preview.rows.length)} แถวแรก — นำเข้าครบทั้ง {nf(preview.totalRows)} แถว</p>
            )}
          </Card>
        </>
      )}

      {result && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">ผลการนำเข้า</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <Stat label="เพิ่มใหม่" value={result.successCount} tone="ok" />
            <Stat label="อัปเดตตามไฟล์" value={result.updatedCount} tone="warn" />
            <Stat label="ตรงกันอยู่แล้ว" value={result.sameCount || 0} />
            <Stat label="ล้มเหลว" value={result.failedRows.length} tone={result.failedRows.length ? 'bad' : undefined} />
          </div>
          {result.failedRows.length > 0 && <RowTable title="รายการที่นำเข้าไม่สำเร็จ" rows={result.failedRows} />}
          <div className="flex gap-2 mt-4">
            <Btn onClick={reset}>นำเข้าไฟล์ใหม่</Btn>
            <Link to="/assets">
              <Btn variant="primary">ไปที่รายการครุภัณฑ์</Btn>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value, tone }) {
  const cls = tone === 'ok' ? 'bg-oksoft text-ok' : tone === 'bad' ? 'bg-badsoft text-bad' : tone === 'warn' ? 'bg-warnsoft text-warn' : 'bg-surface2 text-ink'
  return (
    <div className={`rounded-xl p-4 ${cls}`}>
      <p className="text-[12px] opacity-80">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{nf(value)}</p>
    </div>
  )
}

function RowTable({ title, rows }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2 text-bad">{title} ({nf(rows.length)})</h3>
      <div className="scroll-x max-h-64 overflow-y-auto">
        <table className="w-full min-w-[400px] text-[12px]">
          <thead>
            <tr className="text-muted border-b border-line">
              <th className="text-left font-medium py-2 pr-3 w-20">แถวที่</th>
              <th className="text-left font-medium py-2 pr-3">สาเหตุ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((f, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="py-2 pr-3">{f.row}</td>
                <td className="py-2 pr-3 text-bad">{f.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
