import { Field, SelectField, Combobox } from './UI'
import { STATUS_OPTIONS } from '../data/statusConfig'

// ฟอร์มครุภัณฑ์ — ใช้ทั้งในหน้ารายการ (เพิ่ม/แก้ไข) และหน้ารายละเอียด (แก้ไขในหน้าเลย)
// ช่องที่ใช้กรอง/เรียง/ค้นหา (ตึก ชั้น ห้อง ประเภท ยี่ห้อ รุ่น ผู้ถือครอง) เป็น dropdown ที่พิมพ์ค้นหาได้
// เลือกจากค่าที่มีอยู่ หรือกด "+ เพิ่ม" ชัด ๆ เมื่อเป็นค่าใหม่ — กันพิมพ์ต่างกันนิดเดียวจนกรองไม่เจอ

// ประกอบ "สถานที่ใช้งาน" จาก ตึก/ชั้น/ห้อง (รูปแบบเดียวกับไฟล์ Excel ของคณะ)
export const composeLocation = (f) =>
  [f.building, f.floor && `ชั้น ${f.floor}`, f.roomNo && `ห้อง ${f.roomNo}`].filter(Boolean).join(' ')

export const emptyAssetForm = {
  code: '', name: '', model: '', brand: '', cat: '', note: '', building: '', floor: '', roomNo: '', room: '',
  owner: '', holderUser: '', budget: '', price: '', status: 'ok',
}

const hasParts = (f) => !!(f.building || f.floor || f.roomNo)

// asset (จาก API) -> ค่าในฟอร์ม
export function assetToForm(asset) {
  const f = {
    ...Object.fromEntries(Object.keys(emptyAssetForm).map((k) => [k, asset[k] ?? ''])),
    building: asset.location?.building || '',
    floor: asset.location?.floor || '',
    roomNo: asset.location?.room || '',
  }
  // ข้อมูลเก่าที่สองช่องไม่ตรงกัน จะถูกปรับให้ตรงเมื่อกดบันทึก
  return hasParts(f) ? { ...f, room: composeLocation(f) } : f
}

// ค่าในฟอร์ม -> payload ส่ง API (สถานที่แยกช่องเหมือนไฟล์ Excel)
export function formToPayload(form) {
  const { building, floor, roomNo, room, ...rest } = form
  return { ...rest, location: { building, floor, room: roomNo, label: room } }
}

// limited = กรรมการตรวจนับ: แก้ได้เฉพาะช่องรายละเอียด (เลข/งบ/ราคา/สถานะ ล็อกไว้ — สถานะเปลี่ยนผ่านผลตรวจ)
export default function AssetForm({ id, form, setForm, onSubmit, options = {}, users = [], limited = false }) {
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setLocPart = (key) => (value) =>
    setForm((f) => {
      const next = { ...f, [key]: value }
      return hasParts(next) ? { ...next, room: composeLocation(next) } : next
    })

  return (
    <form id={id} onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
      {limited && (
        <p className="col-span-2 text-[12px] text-muted rounded-xl bg-surface2 px-3 py-2">
          แก้ไขในฐานะกรรมการตรวจนับ — เติมข้อมูลที่ขาดได้ ส่วนเลขครุภัณฑ์ งบประมาณ ราคา และสถานะ แก้ได้เฉพาะเจ้าหน้าที่
        </p>
      )}
      <Field label="เลขครุภัณฑ์" placeholder="เช่น วทท-8พ-69-1/70" required readOnly={limited} value={form.code} onChange={(e) => set('code')(e.target.value)} />
      <Field label="ชื่อครุภัณฑ์" required value={form.name} onChange={(e) => set('name')(e.target.value)} />
      <Combobox label="ยี่ห้อ" allowCreate value={form.brand} onChange={set('brand')} options={options.brand} />
      <Combobox label="รุ่น" allowCreate value={form.model} onChange={set('model')} options={options.model} />
      <Combobox label="ประเภท" required allowCreate className="col-span-2" value={form.cat} onChange={set('cat')} options={options.cat} />
      <div className="col-span-2 grid grid-cols-3 gap-3">
        <Combobox label="ตึก/อาคาร" required allowCreate value={form.building} onChange={setLocPart('building')} options={options.building} />
        <Combobox label="ชั้น" allowCreate value={form.floor} onChange={setLocPart('floor')} options={options.floor} />
        <Combobox label="ห้อง" allowCreate value={form.roomNo} onChange={setLocPart('roomNo')} options={options.roomNo} />
      </div>
      <Field
        label="สถานที่ใช้งาน (ระบบสร้างจากตึก/ชั้น/ห้อง)"
        className="col-span-2"
        value={form.room}
        readOnly
        tabIndex={-1}
      />
      {!limited && <Combobox
        label="บัญชีผู้ถือครอง (ถ้ามี)"
        value={form.holderUser || ''}
        emptyLabel="— ไม่ผูกบัญชี —"
        onChange={(v) => {
          const u = users.find((x) => x.id === v)
          setForm((f) => ({ ...f, holderUser: v, owner: f.owner || u?.name || '' }))
        }}
        options={users.map((u) => ({ value: u.id, label: u.name || u.username }))}
      />}
      <Combobox label="ผู้ถือครอง / ผู้รับผิดชอบ" className={limited ? 'col-span-2' : ''} allowCreate value={form.owner} onChange={set('owner')} options={options.owner} />
      {!limited && <>
      <Combobox
        label="งบประมาณ"
        allowCreate
        value={form.budget}
        emptyLabel="— ดูจากเลขครุภัณฑ์ —"
        onChange={set('budget')}
        options={options.budget}
      />
      <Field label="ราคา (บาท)" type="number" value={form.price} onChange={(e) => set('price')(e.target.value)} />
      <SelectField
        label="สถานะ"
        className="col-span-2"
        value={form.status}
        onChange={(e) => set('status')(e.target.value)}
        options={STATUS_OPTIONS.map((s) => ({ value: s.key, label: s.label }))}
      />
      </>}
      <Field
        label="หมายเหตุ"
        className="col-span-2"
        placeholder="เช่น ใช้งานไม่ได้เพราะ... / สูญหายเมื่อ..."
        value={form.note}
        onChange={(e) => set('note')(e.target.value)}
      />
    </form>
  )
}
