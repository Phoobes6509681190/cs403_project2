import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import * as XLSX from 'xlsx'
import crypto from 'crypto'

/**
 * Mock backend สำหรับทดสอบ frontend เท่านั้น — ห้ามเอาไปใช้งานจริง
 *
 * ทำตาม API contract เดียวกับที่ตกลงไว้ใน README ของ frontend:
 * - login สำเร็จ -> เซ็ต cookie httpOnly (token) + cookie ธรรมดา (csrfToken)
 * - ทุก request ที่แก้ไขข้อมูลต้องแนบ header X-CSRF-Token ให้ตรงกับ cookie csrfToken
 * - ไม่มี database จริง ข้อมูลเก็บในตัวแปรความจำ รีสตาร์ท server แล้วข้อมูลหายทั้งหมด
 */

const PORT = 4000
const JWT_SECRET = 'dev-only-secret-do-not-use-in-production'
const FRONTEND_ORIGIN = 'http://localhost:5173'
const TOKEN_TTL_SECONDS = 8 * 60 * 60 // 8 ชั่วโมง

const app = express()
app.use(express.json())
app.use(cookieParser())
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))
const upload = multer({ storage: multer.memoryStorage() })

/* ------------------------------ ข้อมูลจำลอง ------------------------------ */

const USERS = [
  { id: 'u1', username: 'admin', password: 'admin123', name: 'ผู้ดูแลระบบ', role: 'admin' },
  { id: 'u2', username: 'user', password: 'user123', name: 'เจ้าหน้าที่พัสดุ', role: 'user' },
  { id: 'u3', username: 'somchai', password: 'somchai123', name: 'อ.สมชาย ใจดี', role: 'user' },
  { id: 'u4', username: 'tanakrit', password: 'tanakrit123', name: 'ธนกฤต แซ่ลิ้ม', role: 'user' },
]

const ROOMS = ['ห้อง 107', 'ห้อง 111', 'ห้อง 201', 'ห้อง 202', 'ห้อง 211', 'ห้อง 222', 'ห้อง 301']
const CATS = ['คอมพิวเตอร์', 'สำนักงาน', 'ไฟฟ้าและวิทยุ', 'โฆษณาและเผยแพร่']
const STATUS_CYCLE = ['ok', 'broken', 'repair', 'missing', 'ok', 'ok', 'broken', 'ok']

const TEMPLATES = [
  { name: 'คอมพิวเตอร์โน้ตบุ๊ก', model: 'DELL Latitude 5540', brand: 'DELL' },
  { name: 'โปรเจกเตอร์', model: 'Epson EB-X51', brand: 'Epson' },
  { name: 'เครื่องพิมพ์เลเซอร์', model: 'HP LaserJet Pro M404n', brand: 'HP' },
  { name: 'จอแสดงผล LED', model: 'Samsung 32 นิ้ว FHD', brand: 'Samsung' },
  { name: 'เครื่องสำรองไฟ UPS', model: 'APC Back-UPS 800VA', brand: 'APC' },
  { name: 'คอมพิวเตอร์ตั้งโต๊ะ', model: 'Lenovo ThinkCentre', brand: 'Lenovo' },
]

let assets = Array.from({ length: 42 }, (_, i) => {
  const t = TEMPLATES[i % TEMPLATES.length]
  return {
    id: `a${i + 1}`,
    code: `นพ-ดพ-67-${String(i + 1).padStart(2, '0')}/68`,
    name: t.name,
    model: t.model,
    brand: t.brand,
    cat: CATS[i % CATS.length],
    room: ROOMS[i % ROOMS.length],
    owner: i % 3 === 0 ? 'พี่โจ้' : '—',
    budget: i % 2 === 0 ? 'งบแผ่นดิน' : 'เงินรายได้',
    price: 8000 + (i % 10) * 2500,
    acquiredAt: new Date(2024, i % 12, (i % 27) + 1).toISOString(),
    status: STATUS_CYCLE[i % STATUS_CYCLE.length],
    deleted: false,
  }
})

const assetHistory = {} // { [assetId]: [{id, summary, at, by}] }
const csrfStore = new Map() // token -> csrfToken (ผูก csrf กับ session)
let activeInspection = null

function addHistory(assetId, summary, by) {
  if (!assetHistory[assetId]) assetHistory[assetId] = []
  assetHistory[assetId].unshift({ id: crypto.randomUUID(), summary, at: new Date().toISOString(), by })
}

/* ------------------------------ Auth middleware ------------------------------ */

function auth(req, res, next) {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ message: 'ยังไม่ได้ล็อกอิน' })
  try {
    req.auth = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ message: 'session หมดอายุ กรุณาล็อกอินใหม่' })
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.auth.role)) return res.status(403).json({ message: 'ไม่มีสิทธิ์เข้าถึง' })
    next()
  }
}

// double-submit cookie: header ต้องตรงกับ cookie ที่ผูกไว้กับ session นี้
function csrfProtect(req, res, next) {
  const method = req.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next()

  const expected = csrfStore.get(req.cookies.token)
  const provided = req.headers['x-csrf-token']
  if (!expected || expected !== provided) {
    return res.status(403).json({ message: 'CSRF token ไม่ถูกต้อง' })
  }
  next()
}

/* ------------------------------ Auth routes ------------------------------ */

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {}
  const user = USERS.find((u) => u.username === username && u.password === password)

  if (!user) {
    // ไม่บอกแยกว่า username หรือ password ผิด (กัน user enumeration)
    return res.status(401).json({ message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' })
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS })
  const csrfToken = crypto.randomBytes(24).toString('hex')
  csrfStore.set(token, csrfToken)

  // secure: false เพราะรันบน http://localhost ตอน dev เท่านั้น
  // ของจริงบน production ต้องเป็น secure: true (ต้องใช้ HTTPS) เสมอ
  res.cookie('token', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: TOKEN_TTL_SECONDS * 1000 })
  res.cookie('csrfToken', csrfToken, { httpOnly: false, secure: false, sameSite: 'lax', maxAge: TOKEN_TTL_SECONDS * 1000 })

  res.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role } })
})

app.post('/api/auth/logout', auth, (req, res) => {
  csrfStore.delete(req.cookies.token)
  res.clearCookie('token')
  res.clearCookie('csrfToken')
  res.json({ ok: true })
})

app.get('/api/auth/me', auth, (req, res) => {
  const user = USERS.find((u) => u.id === req.auth.sub)
  if (!user) return res.status(401).json({ message: 'ไม่พบผู้ใช้' })
  res.json({ user: { id: user.id, username: user.username, name: user.name, role: user.role } })
})

app.use((req, res, next) => (req.path.startsWith('/api/auth') ? next() : csrfProtect(req, res, next)))

/* ------------------------------ Users ------------------------------ */

app.get('/api/users', auth, (req, res) => {
  res.json({ items: USERS.map((u) => ({ id: u.id, username: u.username, name: u.name })) })
})

/* ------------------------------ Assets ------------------------------ */

app.get('/api/assets', auth, (req, res) => {
  const { q = '', status = '', room = '', page = 1, perPage = 10 } = req.query
  let list = assets.filter((a) => !a.deleted)

  if (q) {
    const needle = q.toLowerCase()
    list = list.filter((a) => (a.name + a.code + a.model + a.brand).toLowerCase().includes(needle))
  }
  if (status) list = list.filter((a) => a.status === status)
  if (room) list = list.filter((a) => a.room === room)

  const total = list.length
  const p = Number(page)
  const pp = Number(perPage)
  const items = list.slice((p - 1) * pp, p * pp)

  res.json({ items, total, rooms: ROOMS })
})

app.get('/api/assets/:id', auth, (req, res) => {
  const asset = assets.find((a) => a.id === req.params.id && !a.deleted)
  if (!asset) return res.status(404).json({ message: 'ไม่พบครุภัณฑ์' })
  res.json(asset)
})

app.get('/api/assets/:id/history', auth, (req, res) => {
  res.json({ items: assetHistory[req.params.id] || [] })
})

app.post('/api/assets', auth, requireRole('admin'), (req, res) => {
  const asset = { id: crypto.randomUUID(), status: 'ok', deleted: false, ...req.body }
  assets.unshift(asset)
  addHistory(asset.id, 'เพิ่มครุภัณฑ์เข้าระบบ', USERS.find((u) => u.id === req.auth.sub)?.name)
  res.status(201).json(asset)
})

app.put('/api/assets/:id', auth, requireRole('admin'), (req, res) => {
  const idx = assets.findIndex((a) => a.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: 'ไม่พบครุภัณฑ์' })
  assets[idx] = { ...assets[idx], ...req.body }
  addHistory(req.params.id, 'แก้ไขข้อมูลครุภัณฑ์', USERS.find((u) => u.id === req.auth.sub)?.name)
  res.json(assets[idx])
})

// Soft delete — ไม่ลบจริง แค่ซ่อน (ตามสเปก Sprint 2)
app.delete('/api/assets/:id', auth, requireRole('admin'), (req, res) => {
  const idx = assets.findIndex((a) => a.id === req.params.id)
  if (idx === -1) return res.status(404).json({ message: 'ไม่พบครุภัณฑ์' })
  assets[idx].deleted = true
  addHistory(req.params.id, 'ลบครุภัณฑ์ (soft delete)', USERS.find((u) => u.id === req.auth.sub)?.name)
  res.json({ ok: true })
})

app.post('/api/assets/import', auth, requireRole('admin'), upload.single('file'), (req, res) => {
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const mapping = req.body.mappingOverrides ? JSON.parse(req.body.mappingOverrides) : {}
    const labelToKey = { ปกติ: 'ok', ชำรุด: 'broken', รอดำเนินการซ่อม: 'repair', ไม่พบครุภัณฑ์: 'missing' }

    let successCount = 0
    const failedRows = []

    rows.forEach((row, i) => {
      const name = row['ชื่อครุภัณฑ์'] || row['name']
      if (!name) {
        failedRows.push({ row: i + 2, reason: 'ไม่มีชื่อครุภัณฑ์' })
        return
      }
      const rawStatus = String(row['สถานะ'] ?? '').trim()
      const status = labelToKey[rawStatus] || mapping[rawStatus] || 'ok'

      assets.unshift({
        id: crypto.randomUUID(),
        code: row['รหัสครุภัณฑ์'] || `IMPORT-${Date.now()}-${i}`,
        name,
        model: row['รุ่น'] || '',
        brand: row['ยี่ห้อ'] || '',
        cat: row['ประเภท'] || '',
        room: row['สถานที่'] || ROOMS[0],
        owner: row['ผู้ดูแล'] || '—',
        budget: row['งบประมาณ'] || '',
        price: Number(row['ราคา']) || 0,
        acquiredAt: new Date().toISOString(),
        status,
        deleted: false,
      })
      successCount += 1
    })

    res.json({ successCount, failedRows })
  } catch {
    res.status(400).json({ message: 'อ่านไฟล์ไม่สำเร็จ ตรวจสอบรูปแบบไฟล์' })
  }
})

/* ------------------------------ Inspections ------------------------------ */

app.get('/api/inspections/active', auth, (req, res) => {
  if (!activeInspection) return res.status(204).end()
  res.json(activeInspection)
})

app.post('/api/inspections', auth, requireRole('admin'), (req, res) => {
  const { budgetYear, committee } = req.body
  activeInspection = {
    id: crypto.randomUUID(),
    budgetYear,
    committee,
    items: assets
      .filter((a) => !a.deleted)
      .map((a) => ({ assetId: a.id, code: a.code, name: a.name, room: a.room, status: a.status, checked: false })),
  }
  res.status(201).json(activeInspection)
})

app.get('/api/inspections/:id', auth, (req, res) => {
  if (!activeInspection || activeInspection.id !== req.params.id) return res.status(404).json({ message: 'ไม่พบรอบตรวจนับ' })
  res.json(activeInspection)
})

app.post('/api/inspections/:id/items', auth, (req, res) => {
  if (!activeInspection || activeInspection.id !== req.params.id) return res.status(404).json({ message: 'ไม่พบรอบตรวจนับ' })
  const { assetId, status } = req.body
  const item = activeInspection.items.find((it) => it.assetId === assetId)
  if (!item) return res.status(404).json({ message: 'ไม่พบครุภัณฑ์ในรอบนี้' })
  item.status = status
  item.checked = true

  const asset = assets.find((a) => a.id === assetId)
  if (asset) asset.status = status

  res.json(item)
})

app.get('/api/inspections/:id/progress', auth, (req, res) => {
  if (!activeInspection || activeInspection.id !== req.params.id) return res.status(404).json({ message: 'ไม่พบรอบตรวจนับ' })
  const total = activeInspection.items.length
  const checked = activeInspection.items.filter((it) => it.checked).length
  res.json({ total, checked })
})

app.put('/api/inspections/:id/close', auth, requireRole('admin'), (req, res) => {
  if (!activeInspection || activeInspection.id !== req.params.id) return res.status(404).json({ message: 'ไม่พบรอบตรวจนับ' })
  activeInspection = null
  res.json({ ok: true })
})

app.post('/api/inspections/:id/committee', auth, requireRole('admin'), (req, res) => {
  if (!activeInspection || activeInspection.id !== req.params.id) return res.status(404).json({ message: 'ไม่พบรอบตรวจนับ' })
  activeInspection.committee = req.body.members
  res.json(activeInspection)
})

/* ------------------------------ Reports ------------------------------ */

app.get('/api/reports/summary', auth, (req, res) => {
  const live = assets.filter((a) => !a.deleted)
  const byStatus = { ok: 0, broken: 0, repair: 0, missing: 0 }
  const roomCounts = {}

  live.forEach((a) => {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1
    roomCounts[a.room] = (roomCounts[a.room] || 0) + 1
  })

  res.json({
    total: live.length,
    byStatus,
    byRoom: Object.entries(roomCounts).map(([room, count]) => ({ room, count })),
  })
})

app.get('/api/reports/detail', auth, (req, res) => {
  res.json({ items: assets.filter((a) => !a.deleted) })
})

app.get('/api/reports/export', auth, (req, res) => {
  const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx'
  const content = `ไฟล์ตัวอย่าง (mock) — รูปแบบ ${format}\nสร้างเมื่อ ${new Date().toLocaleString('th-TH')}`
  res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename=mock-report.${format}`)
  res.send(Buffer.from(content, 'utf-8'))
})

/* ------------------------------ Start ------------------------------ */

app.listen(PORT, () => {
  console.log(`✅ Mock server พร้อมใช้งานที่ http://localhost:${PORT}`)
  console.log(`   บัญชีทดสอบ: admin / admin123 (สิทธิ์ admin), user / user123 (สิทธิ์ user)`)
})
