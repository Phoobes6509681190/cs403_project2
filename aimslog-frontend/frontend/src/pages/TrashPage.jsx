import { useEffect, useState } from 'react'
import Icon from '../components/icon'
import { Card, Btn, StatusPill, ConfirmDialog, LoadingState, ErrorState, EmptyState, useToast } from '../components/UI'
import { getTrash, restoreAsset, downloadBackup, purgeAsset, emptyTrash } from '../services/assetService'
import { formatDateTimeTH, nf } from '../utils/format'

// ถังขยะ: การลบครุภัณฑ์เป็นแค่การซ่อน (soft delete) จึงกู้คืนได้เสมอ
// + ปุ่มสำรองข้อมูลทั้งระบบ เพราะ MongoDB Atlas แบบฟรีไม่สำรองข้อมูลให้อัตโนมัติ
export default function TrashPage() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')
  const [toRestore, setToRestore] = useState(null)
  const [toPurge, setToPurge] = useState(null) // asset หรือ 'all'
  const [busy, setBusy] = useState(false)
  const [backingUp, setBackingUp] = useState(false)

  const load = async () => {
    setState('loading')
    try {
      const d = await getTrash()
      setItems(d.items || [])
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const restore = async () => {
    setBusy(true)
    try {
      await restoreAsset(toRestore.id)
      toast.success(`กู้คืน "${toRestore.name}" แล้ว`)
      setToRestore(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'กู้คืนไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const purge = async () => {
    setBusy(true)
    try {
      const { deleted } = toPurge === 'all' ? await emptyTrash() : await purgeAsset(toPurge.id)
      toast.success(`ลบถาวร ${nf(deleted)} รายการแล้ว`)
      setToPurge(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'ลบถาวรไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const backup = async () => {
    setBackingUp(true)
    try {
      await downloadBackup()
      toast.success('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว')
    } catch {
      toast.error('สำรองข้อมูลไม่สำเร็จ')
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[240px]">
          <h2 className="font-semibold">สำรองข้อมูล</h2>
        </div>
        <Btn variant="primary" onClick={backup} disabled={backingUp}>
          <Icon name="download" /> {backingUp ? 'กำลังเตรียมไฟล์...' : 'ดาวน์โหลดไฟล์สำรอง'}
        </Btn>
      </Card>

      <Card className="p-4">
        <div className="flex flex-wrap items-start gap-2 mb-3">
          <div className="flex-1 min-w-[240px]">
            <h2 className="font-semibold mb-1">ถังขยะ ({nf(items.length)})</h2>
          </div>
          {items.length > 0 && <Btn variant="danger" onClick={() => setToPurge('all')}>ล้างถังขยะ</Btn>}
        </div>

        {state === 'loading' && <LoadingState />}
        {state === 'error' && <ErrorState onRetry={load} message="โหลดถังขยะไม่สำเร็จ" />}
        {state === 'ready' && items.length === 0 && <EmptyState message="ถังขยะว่าง" />}
        {state === 'ready' && items.length > 0 && (
          <div className="scroll-x">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="text-[12px] text-muted border-b border-line">
                  {['เลขครุภัณฑ์', 'ชื่อ', 'สถานที่', 'สถานะเดิม', 'ลบเมื่อ', ''].map((h) => (
                    <th key={h} className="text-left font-medium py-2 pr-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pr-3 font-mono text-[12px] tabular-nums whitespace-nowrap text-muted">{a.code}</td>
                    <td className="py-2.5 pr-3">{a.name}</td>
                    <td className="py-2.5 pr-3 text-muted">{a.room || '—'}</td>
                    <td className="py-2.5 pr-3"><StatusPill status={a.status} /></td>
                    <td className="py-2.5 pr-3 text-muted whitespace-nowrap">
                      {formatDateTimeTH(a.deletedAt)}{a.deletedBy && <span className="block text-[11px] text-faint">โดย {a.deletedBy}</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Btn onClick={() => setToRestore(a)}><Icon name="restore" /> กู้คืน</Btn>
                        <Btn onClick={() => setToPurge(a)} className="text-bad"><Icon name="trash" /> ลบถาวร</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!toPurge}
        title={toPurge === 'all' ? 'ล้างถังขยะ' : 'ลบถาวร'}
        message={
          toPurge === 'all'
            ? `ลบถาวรทั้ง ${nf(items.length)} รายการในถังขยะ พร้อมประวัติการแก้ไข? กู้คืนไม่ได้อีก (ผลตรวจนับปีที่ผ่านมายังอยู่ในรายงาน)`
            : `ลบ "${toPurge?.name}" (${toPurge?.code}) ถาวร พร้อมประวัติการแก้ไข? กู้คืนไม่ได้อีก`
        }
        confirmLabel="ลบถาวร"
        danger
        loading={busy}
        onConfirm={purge}
        onCancel={() => setToPurge(null)}
      />

      <ConfirmDialog
        open={!!toRestore}
        title="กู้คืนครุภัณฑ์"
        message={`กู้คืน "${toRestore?.name}" (${toRestore?.code}) กลับเข้ารายการครุภัณฑ์?`}
        confirmLabel="กู้คืน"
        loading={busy}
        onConfirm={restore}
        onCancel={() => setToRestore(null)}
      />
    </div>
  )
}
