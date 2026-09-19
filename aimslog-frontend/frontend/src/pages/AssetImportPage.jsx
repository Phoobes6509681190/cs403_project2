import { useState } from 'react'
import * as XLSX from 'xlsx'
import Icon from '../components/icon'
import { Card, Btn, SelectField, LoadingState, useToast } from '../components/UI'
import { importAssets } from '../services/assetService'
import { STATUS_OPTIONS } from '../data/statusConfig'

const KNOWN_STATUS_LABELS = new Set(STATUS_OPTIONS.map((s) => s.label))

export default function AssetImportPage() {
  const toast = useToast()
  const [file, setFile] = useState(null)
  const [rows, setRows] = useState([])
  const [unmapped, setUnmapped] = useState([]) // ค่าสถานะเดิมที่ map อัตโนมัติไม่ได้
  const [mapping, setMapping] = useState({}) // { 'งบคลัง': 'ok', ... }
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null) // { successCount, failedRows: [...] }

  const reset = () => {
    setFile(null)
    setRows([])
    setUnmapped([])
    setMapping({})
    setResult(null)
  }

  const onFileChange = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    reset()
    setFile(f)
    setParsing(true)

    try {
      const buffer = await f.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })

      setRows(json.slice(0, 200)) // แสดง preview จำกัดจำนวนแถว กันหน้าเว็บหนักถ้าไฟล์ใหญ่มาก

      // หาค่าคอลัมน์ "สถานะ" ที่ไม่ตรงกับสถานะมาตรฐานที่ระบบรู้จัก
      const statusValues = new Set(json.map((r) => String(r['สถานะ'] ?? '').trim()).filter(Boolean))
      const notMapped = [...statusValues].filter((v) => !KNOWN_STATUS_LABELS.has(v))
      setUnmapped(notMapped)
      setMapping(Object.fromEntries(notMapped.map((v) => [v, 'ok'])))
    } catch {
      toast.error('อ่านไฟล์ Excel ไม่สำเร็จ ตรวจสอบว่าเป็นไฟล์ .xlsx หรือ .csv ที่ถูกต้อง')
      reset()
    } finally {
      setParsing(false)
    }
  }

  const confirmImport = async () => {
    if (!file) return
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const data = await importAssets(formData, mapping)
      setResult(data)
      toast.success(`นำเข้าสำเร็จ ${data.successCount ?? 0} รายการ`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'นำเข้าข้อมูลไม่สำเร็จ')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="font-semibold mb-1">นำเข้าครุภัณฑ์จาก Excel</h2>
        <p className="text-[12px] text-muted mb-4">
          รองรับไฟล์ .xlsx และ .csv — แถวแรกต้องเป็นชื่อคอลัมน์ เช่น รหัสครุภัณฑ์, ชื่อครุภัณฑ์, สถานะ, สถานที่
        </p>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line rounded-xl py-10 cursor-pointer hover:bg-surface2">
          <Icon name="upload" className="w-6 h-6 text-faint" />
          <span className="text-[13px] text-muted">{file ? file.name : 'คลิกเพื่อเลือกไฟล์ หรือวางไฟล์ที่นี่'}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
        </label>
      </Card>

      {parsing && <LoadingState label="กำลังอ่านไฟล์..." />}

      {!parsing && rows.length > 0 && !result && (
        <>
          {unmapped.length > 0 && (
            <Card className="p-4 border-warn/40">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-warn">
                <Icon name="warning" className="w-4 h-4" /> พบสถานะที่ระบบไม่รู้จัก {unmapped.length} แบบ
              </h3>
              <p className="text-[12px] text-muted mb-3">
                เลือกว่าจะแปลงค่าสถานะเดิมแต่ละแบบให้ตรงกับสถานะมาตรฐานอันไหน (ค่าดั้งเดิมจะยังถูกเก็บไว้ ไม่ถูกลบทิ้ง)
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {unmapped.map((v) => (
                  <SelectField
                    key={v}
                    label={`"${v}" ให้แปลงเป็น`}
                    value={mapping[v]}
                    onChange={(e) => setMapping({ ...mapping, [v]: e.target.value })}
                    options={STATUS_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
                  />
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">ตัวอย่างข้อมูล ({rows.length} แถวแรก)</h3>
              <Btn variant="primary" onClick={confirmImport} disabled={importing}>
                {importing ? 'กำลังนำเข้า...' : 'ยืนยันนำเข้าข้อมูล'}
              </Btn>
            </div>
            <div className="scroll-x">
              <table className="w-full min-w-[700px] text-[12px]">
                <thead>
                  <tr className="text-muted border-b border-line">
                    {Object.keys(rows[0]).map((h) => (
                      <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      {Object.keys(rows[0]).map((h) => (
                        <td key={h} className="py-2 pr-3 whitespace-nowrap">{String(r[h])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 10 && <p className="text-[11px] text-faint mt-2">…และอีก {rows.length - 10} แถว</p>}
          </Card>
        </>
      )}

      {result && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">ผลการนำเข้า</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="rounded-xl bg-oksoft p-4">
              <p className="text-[12px] text-ok">สำเร็จ</p>
              <p className="text-2xl font-bold text-ok">{result.successCount ?? 0}</p>
            </div>
            <div className="rounded-xl bg-badsoft p-4">
              <p className="text-[12px] text-bad">ล้มเหลว</p>
              <p className="text-2xl font-bold text-bad">{result.failedRows?.length ?? 0}</p>
            </div>
          </div>

          {result.failedRows?.length > 0 && (
            <div className="scroll-x">
              <table className="w-full min-w-[500px] text-[12px]">
                <thead>
                  <tr className="text-muted border-b border-line">
                    <th className="text-left font-medium py-2 pr-3">แถวที่</th>
                    <th className="text-left font-medium py-2 pr-3">สาเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {result.failedRows.map((f, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="py-2 pr-3">{f.row}</td>
                      <td className="py-2 pr-3 text-bad">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <Btn className="mt-4" onClick={reset}>นำเข้าไฟล์ใหม่</Btn>
        </Card>
      )}
    </div>
  )
}
