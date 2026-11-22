# AIMSlog — API Contract

ระบบจัดการและตรวจนับครุภัณฑ์ สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยธรรมศาสตร์

| รายการ | ค่า |
|---|---|
| Base URL (production) | `https://aimslog-api.onrender.com/api` |
| Base URL (หน้าเว็บเรียกผ่าน proxy) | `https://aimslog.vercel.app/api` |
| Base URL (พัฒนาในเครื่อง) | `http://localhost:4000/api` |
| รูปแบบข้อมูล | JSON (UTF-8) ยกเว้นอัปโหลด/ดาวน์โหลดไฟล์ Excel |
| เวอร์ชันเอกสาร | ตรงกับโค้ดใน `backend/src/routes/*.js` |

ทดสอบด้วย Postman ได้ทันที: นำเข้าไฟล์ [`aimslog.postman_collection.json`](./aimslog.postman_collection.json) (วิธีใช้อยู่ท้ายเอกสาร)

---

## 1. หลักการทั่วไป

### 1.1 การยืนยันตัวตน (Authentication)

- `POST /auth/login` สำเร็จ → server ตั้ง cookie 2 ตัว อายุ **8 ชั่วโมง**
  - `token` — JWT (**httpOnly**, JavaScript อ่านไม่ได้ กันขโมยผ่าน XSS)
  - `csrfToken` — ค่าสุ่มสำหรับกัน CSRF (JavaScript อ่านได้)
- คำขอที่**แก้ข้อมูล** (POST / PUT / DELETE) จากหน้าเว็บ ต้องส่ง header `X-CSRF-Token` ให้ตรงกับ cookie `csrfToken` (double-submit cookie)
- เครื่องมืออย่าง Postman ใช้ `Authorization: Bearer <JWT>` แทนได้ — แบบนี้ไม่ต้องส่ง CSRF
- ทุก endpoint ยกเว้น `/health`, `/auth/login`, `/auth/logout` ต้อง login
- บัญชีที่ใช้**รหัสชั่วคราว** (`mustChangePassword: true` — Admin สร้าง/ตั้งรหัสให้ หรือใช้สคริปต์กู้รหัส) เรียกได้เฉพาะ `/auth/*`
  endpoint อื่นตอบ `403` พร้อม `"code": "PASSWORD_CHANGE_REQUIRED"` จนกว่าจะเปลี่ยนรหัสผ่าน `PUT /auth/password`

### 1.1.1 ความปลอดภัยการเข้าสู่ระบบ

| กลไก | รายละเอียด |
|---|---|
| ล็อกบัญชี | ใส่รหัสผิด (หรือรหัส MFA ผิด) ติดกัน **5 ครั้ง** → ล็อก **15 นาที** (`429`) แม้รหัสถูกก็เข้าไม่ได้ · Admin ปลดล็อกได้ |
| จำกัดต่อ IP | ผิดเกิน **20 ครั้ง / 15 นาที** จาก IP เดียว → `429` (กันไล่เดาหลายบัญชี) |
| MFA (TOTP) | เปิดได้ทุกบัญชี (แนะนำสำหรับ Admin) — login ต้องกรอกรหัส 6 หลักจากแอป Authenticator หรือรหัสสำรอง |
| ประวัติการเข้าสู่ระบบ | บันทึกทุกครั้ง (สำเร็จ/ไม่สำเร็จ + เหตุผล, IP, อุปกรณ์) เก็บ 180 วัน — Admin ดูได้ที่ `/login-logs` |
| ข้อความ error | รหัสผิดและไม่มีบัญชีตอบข้อความเดียวกัน — เดาไม่ได้ว่ามี username นี้ไหม |

### 1.2 สิทธิ์ (Role)

| สัญลักษณ์ | ความหมาย |
|---|---|
| 🌐 | ไม่ต้อง login |
| 👤 | ผู้ใช้ที่ login แล้วทุกคน (`admin` / `staff` / `user`) |
| ✏️ | `admin` ผู้ดูแลระบบ + `staff` ผู้ใช้ (เจ้าหน้าที่พัสดุ) — เพิ่ม/แก้ไข/นำเข้า |
| 🛡️ | เฉพาะ `admin` ผู้ดูแลระบบ — ลบ ถังขยะ ผู้ใช้ แต่งตั้งกรรมการ |
| 🧾 | ตรวจสิทธิ์ราย "รอบตรวจนับ" — กรรมการที่ได้รับแต่งตั้ง หรือผู้ถือครองของชิ้นนั้น |

สิทธิ์มี 3 ระดับ: `admin` ผู้ดูแลระบบ · `staff` ผู้ใช้ (แก้ไขได้ ลบไม่ได้) · `user` ผู้ดูข้อมูล (ดูอย่างเดียว)
บัญชีใหม่เริ่มเป็น `user` — ผู้ดูแลระบบเป็นคนแต่งตั้งสิทธิ์

> ผู้ดูแลระบบ/ผู้ใช้ **ไม่ได้เป็นกรรมการอัตโนมัติ** (คนจัดซื้อกับคนตรวจต้องเป็นคนละคน) — ดูความคืบหน้าได้ แต่บันทึกผลตรวจได้เฉพาะเมื่อถูกแต่งตั้ง

### 1.3 รูปแบบ Error

ทุก error ตอบเป็น JSON รูปแบบเดียวกัน

```json
{ "success": false, "message": "ข้อความภาษาไทยที่แสดงให้ผู้ใช้ได้เลย" }
```

| HTTP | เกิดเมื่อ |
|---|---|
| 400 | ข้อมูลไม่ครบ / รูปแบบผิด / ไฟล์ไม่ถูกต้อง |
| 401 | ไม่ได้ login หรือ token หมดอายุ |
| 403 | ไม่มีสิทธิ์ หรือ CSRF token ไม่ถูกต้อง |
| 404 | ไม่พบข้อมูล / ไม่พบ API |
| 409 | ขัดกับสถานะปัจจุบัน เช่น เปิดรอบซ้ำ, รอบปิดแล้ว, username ซ้ำ |
| 500 | ข้อผิดพลาดฝั่ง server |

### 1.4 ค่าคงที่ที่ใช้ร่วมกัน

**สถานะครุภัณฑ์ (`status`)**

| key | ชื่อที่แสดง (ตามไฟล์คณะ) | ใช้เป็นผลตรวจนับได้ | นับในยอดสาขา |
|---|---|---|---|
| `ok` | ปกติ | ✅ | ✅ |
| `broken` | ชำรุด (เดิมแยก `disposal` รอจำหน่าย — เลิกใช้ ข้อมูลเดิมถูกแปลงเป็น `broken` ตอนเปิดเซิร์ฟเวอร์) | ✅ | ✅ |
| `unneeded` | เสื่อมสภาพ (หมดความจำเป็น) | ✅ | ✅ |
| `missing` | หาไม่พบ | ✅ ต้องมีหมายเหตุ | ✅ |
| `transferred` | จำหน่ายแล้ว | ✅ ต้องมีหมายเหตุ | ❌ |
| `duplicate` | ข้อมูลซ้ำ | ❌ | ❌ (แสดงบนจอ ไม่ออกในรายงานที่พิมพ์) |
| `dataerror` | ข้อมูลบางส่วนผิด | ❌ | ❌ (แสดงบนจอ ไม่ออกในรายงานที่พิมพ์) |
| `notours` | ไม่ใช่ครุภัณฑ์หน่วยงาน | ❌ | ❌ (แสดงบนจอ ไม่ออกในรายงานที่พิมพ์) |

**เลขครุภัณฑ์** เช่น `วทท-8พ-57-1/80` = หน่วยงาน `วทท` · คณะ `8` · ตัวย่องบ `พ` · ปี พ.ศ. `57` · ชิ้นที่ `1` จาก `80`
(รองรับ `-1-80` ด้วย) — **เลขซ้ำกันได้** จึงใช้ `id` เป็นตัวระบุชิ้นเสมอ

### 1.5 Asset (รูปแบบที่ API ส่งกลับ)

```json
{
  "id": "6730f1c2a1b2c3d4e5f60789",
  "code": "วทท-8พ-57-1/80",
  "codeParts": { "prefix": "วทท", "faculty": "8", "budgetAbbr": "พ", "year": 57, "seq": 1, "total": 80 },
  "name": "เทคโนโลยีสารสนเทศเพื่อการเรียนการสอนสำหรับวิชาพื้นฐาน",
  "model": "", "brand": "DELL", "cat": "",
  "room": "บร.2 ชั้น 1 ห้อง 107",
  "location": { "building": "บร.2", "floor": "1", "room": "107", "label": "บร.2 ชั้น 1 ห้อง 107" },
  "owner": "อ.สมชาย", "holderUser": null,
  "budget": "งบพิเศษ", "fundSource": "งบ มธ.", "price": null,
  "note": "",
  "status": "ok",
  "acquiredAt": null, "lastInspectedAt": "2026-11-09T02:05:00.000Z",
  "createdAt": "...", "updatedAt": "..."
}
```

| ฟิลด์ | ความหมาย |
|---|---|
| `room` | ข้อความ "สถานที่ใช้งาน" (= `location.label`) |
| `owner` | ชื่อผู้ถือครอง (ข้อความ — อาจารย์ที่ไม่มีบัญชีก็ใส่ได้) |
| `holderUser` | id บัญชีผู้ถือครอง (ถ้าผูกไว้ → ยืนยันสภาพของตัวเองในรอบตรวจนับได้) |
| `budget` | ชื่องบ ได้จากตัวย่อในเลขครุภัณฑ์ผ่านตาราง budgets (ถ้าเลขไม่มีตัวย่อ ใช้ `fundSource`) |
| `fundSource` | "แหล่งเงิน" จากไฟล์คณะ (ตัดรหัสนำหน้า เช่น `30 - งบ มธ.` → `งบ มธ.`) |
| `note` | หมายเหตุ (จากคอลัมน์หมายเหตุในไฟล์ หรือจากผลตรวจ จำหน่ายแล้ว/หาไม่พบ) |
| `legacy` | (เฉพาะ `GET /assets/:id`) ทุกคอลัมน์จากไฟล์ Excel: `{ file, sheet, row, importedAt, columns: [{ label, value }] }` |

---

## 2. สรุปทุก Endpoint (48)

| # | Method | Path | สิทธิ์ | หน้าที่ |
|---|---|---|---|---|
| 1 | GET | `/health` | 🌐 | ตรวจว่า API และฐานข้อมูลทำงาน |
| 2 | POST | `/auth/login` | 🌐 | เข้าสู่ระบบ |
| 3 | POST | `/auth/logout` | 🌐 | ออกจากระบบ (ลบ cookie) |
| 4 | GET | `/auth/me` | 👤 | ข้อมูลผู้ใช้ที่ login อยู่ |
| 5 | PUT | `/auth/password` | 👤 | เปลี่ยนรหัสผ่านของตัวเอง |
| 6 | PUT | `/auth/profile` | 👤 | แก้โปรไฟล์ของตัวเอง |
| 6a | POST | `/auth/mfa/verify` | 🌐 | ขั้นที่ 2 ของ login (รหัส 6 หลัก / รหัสสำรอง) |
| 6b | POST | `/auth/mfa/setup` | 👤 | เริ่มตั้งค่า MFA (ได้ QR) |
| 6c | POST | `/auth/mfa/enable` | 👤 | ยืนยันรหัสแรก → เปิด MFA + ได้รหัสสำรอง 8 ชุด |
| 6d | POST | `/auth/mfa/disable` | 👤 | ปิด MFA (ยืนยันด้วยรหัสผ่าน) |
| 6e | POST | `/auth/mfa/backup-codes` | 👤 | สร้างรหัสสำรองชุดใหม่ (ยืนยันด้วยรหัสผ่าน) |
| 7 | GET | `/assets` | 👤 | รายการครุภัณฑ์ (ค้นหา / กรอง / แบ่งหน้า) |
| 7a | GET | `/assets/options` | 👤 | ค่าที่มีอยู่ของแต่ละช่อง (ตึก ชั้น ห้อง ประเภท ยี่ห้อ รุ่น ผู้ถือครอง งบ) สำหรับ dropdown |
| 8 | POST | `/assets` | ✏️ | เพิ่มครุภัณฑ์ |
| 9 | GET | `/assets/:id` | 👤 | รายละเอียดครุภัณฑ์ (+ สถานะในรอบตรวจที่เปิดอยู่) |
| 10 | PUT | `/assets/:id` | ✏️ 🧾 | แก้ไขครุภัณฑ์ (บันทึกประวัติอัตโนมัติ) |
| 11 | DELETE | `/assets/:id` | 🛡️ | ลบ = ย้ายไปถังขยะ (soft delete) |
| 11a | POST | `/assets/bulk-delete` | 🛡️ | ลบหลายรายการไปถังขยะ: `{ ids }` หรือ `{ all: true, query, expected }` (ทุกชิ้นตามตัวกรอง — `expected` ต้องตรงจำนวนที่พบ ไม่ตรงได้ 409) |
| 12 | GET | `/assets/:id/history` | 👤 | ประวัติการเปลี่ยนแปลง |
| 13 | GET | `/assets/trash` | 🛡️ | รายการในถังขยะ |
| 14 | POST | `/assets/:id/restore` | 🛡️ | กู้คืนจากถังขยะ |
| 14a | POST | `/assets/qr-printed` | ✏️ | ทำเครื่องหมายว่าพิมพ์สติกเกอร์ QR แล้ว `{ ids }` |
| 15 | DELETE | `/assets/:id/permanent` | 🛡️ | ลบถาวร (เฉพาะที่อยู่ในถังขยะ) |
| 16 | DELETE | `/assets/trash` | 🛡️ | ล้างถังขยะทั้งหมด |
| 17 | GET | `/assets/import/template` | ✏️ | ดาวน์โหลด Template Excel |
| 18 | POST | `/assets/import/preview` | ✏️ | อ่านไฟล์และเทียบกับระบบ (ยังไม่บันทึก) |
| 19 | POST | `/assets/import` | ✏️ | นำเข้าจริง |
| 20 | GET | `/budgets` | 👤 | ตารางตัวย่องบ → ชื่องบ |
| 21 | GET | `/users` | ✏️ | รายชื่อผู้ใช้ |
| 22 | POST | `/users` | 🛡️ | เพิ่มผู้ใช้ |
| 23 | PUT | `/users/:id` | 🛡️ | เปลี่ยนสิทธิ์ / ปิด-เปิดบัญชี |
| 24 | PUT | `/users/:id/password` | 🛡️ | ตั้งรหัสผ่านใหม่ให้ผู้ใช้ |
| 24a | PUT | `/users/:id/unlock` | 🛡️ | ปลดล็อกบัญชีที่ใส่รหัสผิดเกินกำหนด |
| 24b | PUT | `/users/:id/mfa-reset` | 🛡️ | ปิด MFA ให้ผู้ใช้ที่ทำมือถือหาย |
| 24d | GET | `/activity` | 🛡️ | บันทึกกิจกรรมของครุภัณฑ์ทุกชิ้น (`?action=&by=&q=&from=&to=&page=`) |
| 24c | GET | `/login-logs` | 🛡️ | ประวัติการเข้าสู่ระบบ (`?username=&success=&page=`) |
| 25 | GET | `/inspections` | 👤 | รายการรอบตรวจนับทั้งหมด |
| 26 | GET | `/inspections/active` | 👤 | รอบที่เปิดอยู่ (หรือ `null`) |
| 27 | POST | `/inspections` | 🛡️ | เปิดรอบตรวจนับ + แต่งตั้งกรรมการ |
| 28 | GET | `/inspections/:id` | 👤 | รายละเอียดรอบ + รายการที่ผู้ใช้เห็นได้ |
| 29 | GET | `/inspections/:id/progress` | 👤 | ความคืบหน้า (หน้าเว็บเรียกทุก 3 วินาที) |
| 30 | POST | `/inspections/:id/items` | 🧾 | บันทึกผลตรวจทีละชิ้น |
| 31 | POST | `/inspections/:id/bulk` | 🧾 | บันทึกผลเดียวกันให้หลายชิ้นที่ยังไม่ตรวจ (ทั้งห้อง หรือติ๊กเลือก) |
| 32 | PUT | `/inspections/:id/close` | ✏️ | ปิดรอบ (ล็อกผล) |
| 33 | POST | `/inspections/:id/committee` | 🛡️ | เปลี่ยนรายชื่อกรรมการ |
| 34 | GET | `/reports/summary` | 👤 | สรุปจำนวนแยกตามงบ × สถานะ |
| 35 | GET | `/reports/detail` | 👤 | ตารางรายละเอียดทั้งหมด |
| 36 | GET | `/backup` | 🛡️ | ดาวน์โหลดไฟล์สำรองข้อมูลทั้งระบบ (Excel) |

> ไม่มี `/reports/export` ที่ backend — หน้าเว็บสร้างไฟล์ Excel จาก `/reports/summary` + `/reports/detail` เอง และใช้การพิมพ์ของเบราว์เซอร์สร้าง PDF (ภาษาไทยแสดงถูกต้องโดยไม่ต้องฝังฟอนต์)

---

## 3. รายละเอียดแต่ละกลุ่ม

### 3.1 ระบบ

#### `GET /health` 🌐
```json
{ "success": true, "message": "AIMSlog API is running", "database": "connected" }
```

### 3.2 Authentication

#### `POST /auth/login` 🌐
Request
```json
{ "username": "admin", "password": "••••••••" }
```
Response `200` (+ `Set-Cookie: token=…; HttpOnly` และ `csrfToken=…`)
```json
{
  "success": true,
  "user": { "id": "…", "username": "admin", "name": "เจ้าหน้าที่พัสดุ", "role": "admin",
            "position": "", "email": "", "phone": "", "bio": "", "avatar": "",
            "mustChangePassword": false }
}
```
Error: `400` ไม่กรอกครบ · `401` ชื่อผู้ใช้/รหัสผ่านผิด หรือบัญชีถูกปิด · `429` บัญชีถูกล็อก / IP ถูกจำกัด

**ถ้าบัญชีเปิด MFA** → ยังไม่ออก cookie แต่ตอบ
```json
{ "success": true, "mfaRequired": true, "mfaToken": "<JWT อายุ 5 นาที ใช้ได้แค่ขั้นยืนยัน MFA>" }
```
แล้วเรียก `POST /auth/mfa/verify` `{ "mfaToken": "…", "code": "123456" }` (หรือรหัสสำรอง `ABCDE-12345`)
→ ได้ cookie session + `{ user, backupCodesLeft? }` · ผิดได้ `401` (นับรวมในการล็อกบัญชี)
`mfaToken` ใช้แทน session ไม่ได้ (เรียก API อื่นจะได้ `401`)

#### `POST /auth/logout` 🌐
ลบ cookie ทั้งสองตัว → `{ "success": true }`

#### `GET /auth/me` 👤
→ `{ "success": true, "user": { …เหมือน login… } }` · `401` ถ้า session หมดอายุหรือบัญชีถูกปิด

#### `PUT /auth/password` 👤
```json
{ "currentPassword": "รหัสเดิม", "newPassword": "รหัสใหม่อย่างน้อย8ตัว" }
```
→ `{ "success": true, "user": { …, "mustChangePassword": false } }` และ**ออก session ใหม่** (cookie `token` ใหม่ที่ไม่มีเงื่อนไขรหัสชั่วคราว)
Error: `400` รหัสเดิมผิด / สั้นกว่า 8 ตัว / ซ้ำรหัสเดิม

#### `PUT /auth/profile` 👤
ส่งเฉพาะฟิลด์ที่ต้องการแก้
```json
{ "name": "…", "position": "…", "email": "…", "phone": "…", "bio": "≤300 ตัวอักษร",
  "avatar": "data:image/jpeg;base64,…  (หรือ \"\" เพื่อลบรูป)" }
```
→ `{ "success": true, "user": { … } }` · `400` ชื่อว่าง / อีเมลผิดรูปแบบ / รูปไม่ใช่ PNG-JPEG-WebP

### 3.3 ครุภัณฑ์

#### `GET /assets` 👤
| Query | ความหมาย |
|---|---|
| `q` | ค้นหาบางส่วน (ไม่สนตัวพิมพ์) ใน เลขครุภัณฑ์ ชื่อ ยี่ห้อ รุ่น ผู้ถือครอง สถานที่ |
| `status` | กรองตามสถานะ (key ในข้อ 1.4) |
| `room` | กรองตาม "ระบุ สถานที่ใช้งาน" (ตรงทั้งข้อความ) |
| `budget` | กรองตามชื่องบ |
| `holderUser=me` | เฉพาะที่ผู้ใช้คนนี้ถือครอง |
| `page`, `perPage` | แบ่งหน้า (ค่าเริ่มต้น 1, 20 · สูงสุด 200) |
| `sort=-createdAt` | เรียงจากเพิ่มล่าสุด (ค่าเริ่มต้นเรียงตามปีในเลขครุภัณฑ์) |
| `qr=unprinted` | เฉพาะชิ้นที่ยังไม่เคยพิมพ์สติกเกอร์ QR |

```json
{ "success": true, "items": [ Asset… ], "total": 22, "page": 1, "perPage": 20,
  "rooms": ["บร.2 ชั้น 1 ห้อง 107"], "budgets": ["งบพิเศษ"] }
```
`rooms` / `budgets` = ตัวเลือกสำหรับ dropdown กรอง · `qrUnprinted` = จำนวนที่ยังไม่เคยพิมพ์ QR (ไม่รวมตัดโอน)

#### `POST /assets/qr-printed` ✏️
`{ "ids": ["…", "…"] }` → `{ "success": true, "updated": 6 }` — ทำเครื่องหมายว่าพิมพ์สติกเกอร์ QR แล้ว (`qrPrintedAt`)

#### `POST /assets` ✏️ · `PUT /assets/:id` ✏️ 🧾
```json
{
  "code": "วทท-8พ-69-1/70", "name": "คอมพิวเตอร์ตั้งโต๊ะ", "brand": "DELL", "model": "OptiPlex",
  "cat": "คอมพิวเตอร์",
  "location": { "building": "บร.2", "floor": "1", "room": "107", "label": "" },
  "owner": "อ.สมชาย", "holderUser": "<userId หรือ null>",
  "budget": "", "price": 25000, "status": "ok", "note": ""
}
```
- `budget` ว่าง → ระบบอ่านจากตัวย่อในเลขครุภัณฑ์ให้
- `location.label` ว่าง → ระบบประกอบเป็น "บร.2 ชั้น 1 ห้อง 107" ให้
- ทุกช่องที่เปลี่ยน (สถานะ สถานที่ ผู้ถือครอง เลข ชื่อ ยี่ห้อ รุ่น ประเภท งบ ราคา หมายเหตุ) ถูกบันทึกเป็นประวัติ (ค่าเดิม → ค่าใหม่ + ชื่อผู้แก้จาก JWT)
- **กรรมการของรอบที่เปิดอยู่** (ที่ไม่ใช่ admin/staff) `PUT` ได้เฉพาะครุภัณฑ์ในรอบ และเฉพาะช่องรายละเอียด
  (ชื่อ ยี่ห้อ รุ่น ประเภท สถานที่ ผู้ถือครอง หมายเหตุ) — ช่องอื่นถูกตัดทิ้ง · ประวัติบันทึกเป็น `inspect`

ตอบกลับเป็น Asset (`201` สำหรับเพิ่ม)

#### `GET /assets/:id` 👤
Asset + ข้อมูลรอบตรวจนับที่เปิดอยู่ (ใช้ตอนสแกน QR แล้วกดตรวจในหน้านี้)
```json
{ …Asset…, "inspection": { "id": "…", "budgetYear": 2569, "checked": false, "result": null,
  "checkedBy": "", "checkedAt": null, "note": "", "canInspect": true, "isCommittee": false },
  "legacy": { "file": "ครุภัณฑ์ปี68.xlsx", "sheet": "…", "row": 12, "columns": [ { "label": "ผู้ขาย", "value": "…" } ] } }
```
`inspection` เป็น `null` ถ้าไม่มีรอบเปิดอยู่

#### `DELETE /assets/:id` 🛡️
ย้ายไปถังขยะ (ไม่ลบจริง) → `{ "success": true }` — ถังขยะของแต่ละคนเห็นเฉพาะรายการที่ตัวเองลบ

#### `GET /assets/options` 👤
ค่าที่มีอยู่ในระบบของแต่ละช่อง ใช้ทำ dropdown ที่พิมพ์ค้นหาได้
`{ building: [], floor: [], roomNo: [], room: [], cat: [], brand: [], model: [], owner: [], budget: [] }`

#### `GET /activity` 🛡️
บันทึกกิจกรรมรวมทุกครุภัณฑ์ (ใครทำอะไร เมื่อไหร่) · `?action=create|update|delete|restore|import|inspect&by=&q=&from=YYYY-MM-DD&to=&page=&perPage=`
`{ total, page, perPage, items: [ { id, action, summary, changes, by, at, asset: { id, code, name } } ] }`

#### `GET /assets/:id/history` 👤
```json
{ "success": true, "items": [
  { "id": "…", "action": "update", "summary": "สถานที่: บร.2 ชั้น 1 ห้อง 107 → บร.2 ชั้น 1 ห้อง 110",
    "changes": [ { "field": "location", "oldValue": "…", "newValue": "…" } ],
    "by": "เจ้าหน้าที่พัสดุ", "at": "2026-11-09T03:00:00.000Z" } ] }
```
`action`: `create` · `update` · `delete` · `restore` · `import` · `inspect`

#### ถังขยะ 🛡️
| Endpoint | ผล |
|---|---|
| `GET /assets/trash` | `{ items: [ Asset + deletedAt + deletedBy ] }` (ล่าสุดก่อน สูงสุด 500) |
| `POST /assets/:id/restore` | กู้คืน → Asset · `404` ถ้าไม่อยู่ในถังขยะ |
| `DELETE /assets/:id/permanent` | ลบถาวร + ประวัติ → `{ deleted: 1 }` · `404` ถ้ายังไม่อยู่ในถังขยะ |
| `DELETE /assets/trash` | ล้างถังขยะ → `{ deleted: n }` |

ลบถาวรแล้วผลตรวจนับปีที่ผ่านมายังอยู่ในรายงาน (ผลตรวจเก็บสำเนาข้อมูลไว้)

### 3.4 นำเข้า Excel

ไฟล์ `.xlsx` `.xls` `.csv` ไม่เกิน 10 MB · ระบบหาแถวหัวตารางเองใน 20 แถวแรก

**คอลัมน์ที่รู้จัก** (ตามไฟล์ของคณะ — ตัวหนาคือจำเป็น)

| ข้อมูล | ชื่อคอลัมน์ที่รองรับ |
|---|---|
| **เลขครุภัณฑ์** | รหัสสินทรัพย์อ้างอิง, รหัสสินทรัพย์, รหัสครุภัณฑ์, เลขครุภัณฑ์ |
| **ชื่อ** | ชื่อสินทรัพย์, ชื่อครุภัณฑ์, รายการ |
| ตึก / ชั้น / ห้อง | ตึก/อาคาร, ชั้น, ห้อง |
| สถานที่ | ระบุ สถานที่ใช้งาน, สถานที่ใช้งาน, สถานที่ |
| สถานะ | สภาพ, สถานะ |
| ยี่ห้อ / รุ่น / ประเภท / ราคา | ยี่ห้อ, รุ่น, ประเภท, ราคา |
| ผู้ถือครอง | ผู้ถือครอง, ผู้รับผิดชอบ, ผู้ดูแล, ผู้ใช้งาน |

ทุกคอลัมน์ (รวมที่ระบบไม่รู้จัก) ถูกเก็บไว้ใน `legacy` ของครุภัณฑ์ — ข้อมูลเดิมไม่หาย

#### `POST /assets/import/preview` 🛡️ (multipart: `file`)
อ่านไฟล์ เทียบกับระบบด้วย **เลขครุภัณฑ์ + ชื่อ** — ยังไม่บันทึก
```json
{
  "totalRows": 24, "newRows": 3, "sameRows": 15, "changedTotal": 2, "missingTotal": 1,
  "errors": [ { "row": 26, "reason": "ไม่มีเลขครุภัณฑ์" } ],
  "dupInFile": [],
  "unknownStatuses": [ { "label": "เสียบางส่วน", "count": 1 } ],
  "unknownBudgets": [ { "abbr": "ค", "count": 4, "example": "วทท-8ค-50-1/4" } ],
  "rows": [ { "row": 7, "kind": "changed", "building": "บร.2", "floor": "1", "room": "107",
              "locationLabel": "บร.2 ชั้น 1 ห้อง 107", "statusKey": "ok", "code": "…", "name": "…",
              "brand": "DELL", "holderName": "", "was": { "room": "110" }, "errors": [] } ],
  "missing": [ { "id": "…", "code": "…", "name": "…", "room": "…", "status": "ok" } ]
}
```
- `kind`: `new` เพิ่มใหม่ · `same` ตรงกัน · `changed` จะอัปเดตตามไฟล์ · `dup` ซ้ำในไฟล์ · `invalid` ข้อมูลไม่ครบ
- `was` = ค่าเดิมในระบบของช่องที่จะเปลี่ยน (ช่องที่เทียบ: สถานะ, ตึก, ชั้น, ห้อง, สถานที่, ผู้ถือครอง, ยี่ห้อ — ช่องว่างในไฟล์ไม่นับว่าต่าง)
- `missing` = มีในระบบแต่ไม่อยู่ในไฟล์ (ไม่นับที่ตัดโอนแล้ว) — แจ้งให้ตรวจสอบ ไม่เปลี่ยนอัตโนมัติ

#### `POST /assets/import` 🛡️ (multipart)
| ฟิลด์ | ความหมาย |
|---|---|
| `file` | ไฟล์เดียวกับตอน preview |
| `statusMapping` | JSON `{ "ป้ายสถานะที่ไม่รู้จัก": "status key" }` |
| `budgetMapping` | JSON `{ "ตัวย่อ": "ชื่องบ" }` — บันทึกเป็นงบเดิม (active=false) ครั้งต่อไปรู้จักเอง |
| `updates` (ไม่บังคับ) | JSON `{ "<assetId>": ["status","room",…] }` — ถ้าไม่ส่ง = อัปเดตทุกช่องที่ต่างให้ตรงกับไฟล์ |

```json
{ "success": true, "successCount": 3, "updatedCount": 2, "sameCount": 15,
  "skippedCount": 0, "skippedRows": [], "failedRows": [ { "row": 26, "reason": "ไม่มีเลขครุภัณฑ์" } ] }
```
ค่าเดิมของรายการที่อัปเดตถูกบันทึกในประวัติ ("อัปเดตจาก Excel")

#### `GET /assets/import/template` 🛡️
ไฟล์ `aimslog-template.xlsx` (คอลัมน์ตามไฟล์ของคณะ + ผู้ถือครอง)

### 3.5 งบประมาณ

#### `GET /budgets` 👤
```json
{ "success": true, "items": [
  { "id": "…", "abbr": "พ", "name": "งบพิเศษ", "active": true },
  { "id": "…", "abbr": "กท", "name": "งบกองทุนค่าธรรมเนียม", "active": true } ] }
```
`active: false` = งบในอดีต (เช่น งบคลัง) — ยังแสดงในรายงานแต่ติดป้าย "งบเดิม"

### 3.6 ผู้ใช้ 🛡️

| Endpoint | Request | Response |
|---|---|---|
| `GET /users?active=1` | `active=1` = เฉพาะบัญชีที่เปิดใช้ | `{ items: [ { id, username, name, role, position, email, phone, avatar, active } ] }` |
| `POST /users` | `{ username, name, password (≥8), role: "admin"\|"staff"\|"user", position? }` | ผู้ใช้ที่สร้าง (`201`) · `409` username ซ้ำ |
| `PUT /users/:id` | `{ role?, active? }` | ผู้ใช้ · `400` ถ้าแก้บัญชีตัวเอง (กันล็อกตัวเองออก) |
| `PUT /users/:id/password` | `{ newPassword (≥8) }` | `{ success: true }` |

`GET /users` เรียกได้ทั้ง `admin` และ `staff` (staff ได้เฉพาะ id/ชื่อ/ตำแหน่ง ไว้เลือกผู้ถือครอง) — ที่เหลือเฉพาะ `admin`

บัญชีที่ปิด (`active: false`) login ไม่ได้ แต่ประวัติที่เคยบันทึกยังอยู่
บัญชีที่ Admin สร้างหรือตั้งรหัสให้ จะเป็น `mustChangePassword: true` — ผู้ใช้ต้องตั้งรหัสของตัวเองตอน login

**Admin คนเดียวลืมรหัส:** รันสคริปต์กู้รหัสบนเครื่องที่มี `MONGO_URI` (ไม่มี API บนเว็บ)
```bash
cd backend && npm run reset-password -- <username>
```
สคริปต์ให้พิมพ์ `yes` ยืนยัน สุ่มรหัสชั่วคราวให้และแสดงครั้งเดียว แล้วบังคับเปลี่ยนรหัสตอน login

### 3.7 ตรวจนับ

#### `POST /inspections` 🛡️
```json
{ "budgetYear": 2569, "committee": [ { "userId": "…" }, { "userId": "…" } ] }
```
- สร้างรายการตรวจ 1 รายการต่อครุภัณฑ์ 1 ชิ้น (ไม่รวมที่ตัดโอน) พร้อมสำเนาข้อมูล ณ วันเปิดรอบ
- `409` ถ้ามีรอบเปิดอยู่แล้ว · `400` ปีไม่ใช่ พ.ศ. / ไม่มีกรรมการ / ไม่มีครุภัณฑ์

#### `GET /inspections/active` · `GET /inspections/:id` 👤
```json
{
  "id": "…", "budgetYear": 2569, "status": "open", "createdAt": "…", "closedAt": null,
  "committee": [ { "id": "…", "name": "อ.สมชาย", "username": "somchai" } ],
  "isCommittee": true, "scope": "all",
  "results": ["ok","broken","unneeded","transferred","missing"], "noteRequired": ["transferred","missing"],
  "items": [ { "id": "…", "assetId": "…", "code": "…", "name": "…", "room": "…", "owner": "",
               "status": null, "checked": false, "checkedBy": "", "checkedAt": null,
               "method": null, "note": "", "canInspect": true } ]
}
```
- `scope: "all"` = กรรมการ/Admin เห็นทุกชิ้น · `"mine"` = ผู้ใช้ทั่วไปเห็นเฉพาะชิ้นที่ตัวเองถือครอง
- `method`: `committee` = กรรมการตรวจ · `self` = ผู้ถือครองยืนยันเอง

#### `GET /inspections/:id/progress` 👤
```json
{ "total": 164, "checked": 120, "selfChecked": 5, "percent": 73,
  "byResult": { "ok": 110, "broken": 6, "missing": 4 } }
```
หน้าเว็บเรียกทุก 3 วินาที (polling) แทน WebSocket — ง่ายกว่าและเพียงพอสำหรับงานนี้

#### `POST /inspections/:id/items` 🧾
```json
{ "assetId": "…", "status": "broken", "note": "จอแตก" }
```
- `status`: `ok` `broken` `unneeded` `transferred` `missing` — `transferred` (จำหน่ายแล้ว) และ `missing` (หาไม่พบ) **ต้องมี `note`** ไม่งั้น `400`
- 1 ชิ้นนับ 1 ครั้งต่อรอบ — ส่งซ้ำ = **แก้ผล** (ไม่ได้นับเพิ่ม)
- อัปเดตสถานะครุภัณฑ์ + วันที่ตรวจล่าสุด และบันทึกประวัติถ้าสถานะเปลี่ยน
- `403` ไม่ใช่กรรมการ/ผู้ถือครอง · `409` รอบปิดแล้ว

#### `POST /inspections/:id/bulk` 🧾 (เฉพาะกรรมการ)
```json
{ "room": "บร.2 ชั้น 1 ห้อง 107", "status": "ok" }
{ "assetIds": ["…", "…"], "status": "missing", "note": "ห้องรื้อปรับปรุง" }
```
ทั้งห้อง (`room`) หรือติ๊กเลือกหลายชิ้น (`assetIds`, สูงสุด 2000) — บันทึกผลเดียวกันให้**เฉพาะชิ้นที่ยังไม่ตรวจ** → `{ "success": true, "updated": 37, "status": "ok" }`

#### `PUT /inspections/:id/close` ✏️
ปิดรอบ ล็อกผล → `{ "success": true, "progress": { … } }` · `409` ถ้าปิดไปแล้ว
- **คนที่เปิดรอบ** ปิดได้เลย
- **ผู้ดูแลระบบ/ผู้ใช้คนอื่น** ปิดแทนได้ แต่ต้องส่ง `{ "reason": "เหตุผลอย่างน้อย 5 ตัวอักษร" }` ไม่งั้นได้ `400`
- รายละเอียดรอบ (`GET /inspections/:id`) มี `createdBy`, `closedBy`, `closeReason`, `canClose`, `closeNeedsReason`

#### `POST /inspections/:id/committee` 🛡️
`{ "members": ["userId", "userId"] }` — แทนที่รายชื่อเดิม (เฉพาะรอบที่ยังเปิด)

#### `GET /inspections` 👤
`{ items: [ { id, budgetYear, status, createdAt, closedAt, createdBy, closedBy, closedByOther, closeReason, committee, committeeCount, progress } ] }`
(`closedByOther: true` = Admin คนอื่นปิดแทน — `closeReason` คือเหตุผล)

### 3.8 รายงาน 👤

#### `GET /reports/summary?budget=&room=`
```json
{
  "generatedAt": "…", "total": 207, "transferred": 19,
  "byStatus": { "ok": 172, "broken": 18, "unneeded": 12, "missing": 5, "transferred": 19 },
  "groups": [ { "budget": "งบพิเศษ", "active": true, "ok": 120, "broken": 11,
                "unneeded": 5, "missing": 2, "transferred": 17, "total": 138 } ],
  "totals": { "ok": 172, "…": 0, "total": 207 },
  "byRoom": [ { "room": "บร.2 ชั้น 1 ห้อง 107", "count": 80 } ],
  "inspection": { "id": "…", "budgetYear": 2569, "status": "open", "progress": { … } }
}
```
`total` **ไม่รวมจำหน่ายแล้ว** (`transferred`) และสถานะปัญหาข้อมูล (`dataIssue` แสดงแยก)

#### `GET /reports/detail?budget=&room=&status=`
`{ inspectionYear: 2569, items: [ Asset + inspectedInRound + inspectedBy ] }` เรียงตาม งบ → สถานที่ → เลขครุภัณฑ์

### 3.9 สำรองข้อมูล 🛡️

#### `GET /backup`
ไฟล์ `aimslog-backup-YYYY-MM-DD.xlsx` — sheet: ครุภัณฑ์ (รวมในถังขยะ), ประวัติ, ผลตรวจนับ, งบประมาณ, ผู้ใช้ (ไม่มีรหัสผ่าน)
MongoDB Atlas แบบฟรีไม่สำรองข้อมูลอัตโนมัติ — แนะนำให้ดาวน์โหลดทุกเดือนและก่อนนำเข้า Excel ทุกครั้ง

---

## 4. ทดสอบด้วย Postman

1. Postman → **Import** → เลือกไฟล์ `docs/aimslog.postman_collection.json`
2. คลิกชื่อ collection → แท็บ **Variables**
   - `baseUrl` = `https://aimslog-api.onrender.com/api` (หรือ `http://localhost:4000/api`)
   - `username` / `password` = บัญชี Admin ของคุณ (อย่าบันทึกรหัสจริงลงไฟล์ที่ commit)
3. รัน **Auth → Login** ก่อน — script จะเก็บ JWT ไว้ในตัวแปร `token` ให้ทุกคำขอใช้ `Authorization: Bearer` อัตโนมัติ
4. คำขอที่สร้างข้อมูล (เพิ่มครุภัณฑ์, เปิดรอบ, เพิ่มผู้ใช้) จะเก็บ id ไว้ใน `assetId` / `inspectionId` / `userId` ให้คำขอถัดไปใช้
5. รันทั้ง collection ได้ด้วย **Run collection** — ทุกคำขอมี test ตรวจ status code

> คำขอกลุ่ม "ลบถาวร / ล้างถังขยะ" ลบข้อมูลจริง — ทดสอบกับฐานข้อมูลทดสอบ หรือดาวน์โหลดไฟล์สำรองก่อน
