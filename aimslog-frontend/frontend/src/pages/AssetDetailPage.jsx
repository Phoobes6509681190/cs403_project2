import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../components/icon'
import { Card, Btn, StatusPill, LoadingState, ErrorState, EmptyState } from '../components/UI'
import AssetForm, { assetToForm, formToPayload } from '../components/AssetForm'
import { useAuth } from '../hooks/useAuth'
import { canEdit as canEditRole } from '../data/roles'
import { getUsers } from '../services/userService'
import { QRCodeSVG } from 'qrcode.react'
import { STATUS } from '../data/statusConfig'
import { submitInspectionItem } from '../services/inspectionService'
import { InspectPicker } from '../components/InspectButtons'
import { useToast } from '../components/UI'
import { getAsset, getAssetHistory, getAssetOptions, updateAsset } from '../services/assetService'
import { formatDateTH, formatDateTimeTH, currency } from '../utils/format'

export default function AssetDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asset, setAsset] = useState(null)
  const [history, setHistory] = useState([])
  const [state, setState] = useState('loading')
  const [saving, setSaving] = useState(false)
  const [editingResult, setEditingResult] = useState(false)
  const toast = useToast()
  const { role } = useAuth()
  const fullEdit = canEditRole(role)
  // กรรมการรอบที่เปิดอยู่แก้ได้เฉพาะช่องรายละเอียด (ชื่อ ยี่ห้อ รุ่น ประเภท สถานที่ ผู้ถือ หมายเหตุ)
  const committeeEdit = !fullEdit && !!asset?.inspection?.isCommittee
  const canEdit = fullEdit || committeeEdit
  const [searchParams] = useSearchParams()
  // แก้ไขในหน้านี้ได้เลยทุกช่อง (ผู้ดูแลระบบ / ผู้ใช้)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState(null)
  const [options, setOptions] = useState({})
  const [users, setUsers] = useState([])
  const startEdit = () => {
    setForm(assetToForm(asset))
    setEditMode(true)
    getAssetOptions().then(setOptions).catch(() => {})
    if (fullEdit) getUsers({ active: 1 }).then((d) => setUsers(d.items || [])).catch(() => {})
  }
  // มาจากปุ่ม "แก้ข้อมูล" ในหน้าตรวจนับ -> เปิดโหมดแก้ไขให้เลย
  useEffect(() => {
    if (asset && canEdit && searchParams.get('edit') === '1' && !editMode) startEdit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.id, canEdit])
  const saveEdit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updateAsset(asset.id, formToPayload(form))
      toast.success('บันทึกการแก้ไขเรียบร้อยแล้ว')
      setEditMode(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกข้อมูลไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const inspect = async (status, note) => {
    setSaving(true)
    try {
      await submitInspectionItem(asset.inspection.id, asset.id, status, note)
      toast.success(`บันทึกผลตรวจ: ${STATUS[status].label}`)
      setEditingResult(false)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'บันทึกผลตรวจไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  const load = async () => {
    setState('loading')
    try {
      const [assetData, historyData] = await Promise.all([getAsset(id), getAssetHistory(id)])
      setAsset(assetData)
      setHistory(historyData.items || [])
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (state === 'loading') return <LoadingState />
  if (state === 'error') return <ErrorState onRetry={load} message="โหลดรายละเอียดครุภัณฑ์ไม่สำเร็จ" />

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/assets')} className="flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
        <Icon name="left" className="w-4 h-4" /> กลับไปรายการครุภัณฑ์
      </button>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] text-faint font-mono text-[12px] tabular-nums">{asset.code}</p>
            <h2 className="text-lg font-bold">{asset.name}</h2>
            <p className="text-[13px] text-muted">{[asset.brand, asset.model].filter(Boolean).join(' · ') || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={asset.status} />
            {canEdit && !editMode && (
              <Btn onClick={startEdit}>
                <Icon name="edit" /> แก้ไข
              </Btn>
            )}
          </div>
        </div>

        {editMode && form ? (
          <div className="mt-5">
            <AssetForm id="asset-edit" form={form} setForm={setForm} onSubmit={saveEdit} options={options} users={users} limited={committeeEdit} />
            <div className="flex justify-end gap-2 mt-4">
              <Btn onClick={() => setEditMode(false)} disabled={saving}>ยกเลิก</Btn>
              <Btn variant="primary" type="submit" form="asset-edit" disabled={saving}>{saving ? 'กำลังบันทึก...' : 'บันทึก'}</Btn>
            </div>
          </div>
        ) : (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-[13px]">
            <div><p className="text-faint text-[11px]">ประเภท</p><p>{asset.cat || '—'}</p></div>
            <div><p className="text-faint text-[11px]">สถานที่</p><p>{asset.room}</p></div>
            <div><p className="text-faint text-[11px]">ผู้ถือครอง</p><p>{asset.owner || '—'}</p></div>
            <div><p className="text-faint text-[11px]">งบประมาณ</p><p>{asset.budget || '—'}{asset.fundSource && asset.fundSource !== asset.budget && <span className="block text-[11px] text-faint">แหล่งเงิน: {asset.fundSource}</span>}</p></div>
            <div><p className="text-faint text-[11px]">ราคา</p><p>{asset.price ? currency(asset.price) : '—'}</p></div>
            <div><p className="text-faint text-[11px]">ปีงบที่ซื้อ</p><p>{asset.codeParts?.year ? `พ.ศ. ${asset.codeParts.year < 100 ? 2500 + asset.codeParts.year : asset.codeParts.year}` : '—'}</p></div>
            <div><p className="text-faint text-[11px]">ลำดับในชุด</p><p>{asset.codeParts ? `${asset.codeParts.seq} จาก ${asset.codeParts.total}` : '—'}</p></div>
            <div><p className="text-faint text-[11px]">ตรวจนับล่าสุด</p><p>{formatDateTH(asset.lastInspectedAt)}</p></div>
            {asset.note && (
              <div className="col-span-2 sm:col-span-3"><p className="text-faint text-[11px]">หมายเหตุ</p><p>{asset.note}</p></div>
            )}
          </div>
        )}
      </Card>

      {asset.inspection && (
        <Card className="p-4">
          <h3 className="font-semibold mb-1">ตรวจนับรอบปี {asset.inspection.budgetYear}</h3>
          <p className="text-[12px] text-muted mb-3">
            {asset.inspection.checked
              ? `ตรวจแล้วโดย ${asset.inspection.checkedBy} · ${formatDateTimeTH(asset.inspection.checkedAt)}`
              : 'ยังไม่ได้ตรวจในรอบนี้'}
          </p>
          {asset.inspection.canInspect ? (
            asset.inspection.checked && !editingResult ? (
              <div className="flex flex-wrap items-center gap-3">
                <StatusPill status={asset.inspection.result} />
                {asset.inspection.note && <span className="text-[12px] text-muted">หมายเหตุ: {asset.inspection.note}</span>}
                <button onClick={() => setEditingResult(true)} className="text-[12px] text-brand hover:underline">แก้ไขผล</button>
              </div>
            ) : (
              <InspectPicker
                disabled={saving}
                current={asset.inspection.checked ? asset.inspection.result : ''}
                currentNote={asset.inspection.note}
                assetLabel={`${asset.code} ${asset.name}`}
                onSave={inspect}
                onCancel={editingResult ? () => setEditingResult(false) : undefined}
              />
            )
          ) : null}
        </Card>
      )}

      <Card className="p-4 flex items-center gap-4">
        <div className="bg-white p-2 rounded-lg">
          <QRCodeSVG value={`${window.location.origin}/assets/${asset.id}`} size={96} />
        </div>
        <div className="text-[12px] text-muted">
          <p className="font-medium text-ink text-[13px]">QR Code</p>
          <Link to={`/assets/labels?ids=${asset.id}`} className="text-brand hover:underline">พิมพ์สติกเกอร์</Link>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Icon name="history" className="w-4 h-4" /> ประวัติการเปลี่ยนแปลง
        </h3>

        {history.length === 0 ? (
          <EmptyState message="ยังไม่มีประวัติการเปลี่ยนแปลง" />
        ) : (
          <ol className="space-y-4">
            {history.map((h) => (
              <li key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand mt-1.5" />
                  <span className="flex-1 w-px bg-line" />
                </div>
                <div className="pb-1">
                  <p className="text-[13px] font-medium">{h.summary}</p>
                  <p className="text-[11px] text-faint">
                    {formatDateTimeTH(h.at)} · โดย {h.by || 'ระบบ'}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  )
}
