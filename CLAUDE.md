# AIMSlog — ระบบจัดการและตรวจนับครุภัณฑ์ (โปรเจค CS403)

ผู้ใช้หลัก: พี่เป้ (เจ้าหน้าที่พัสดุ = Admin) สาขาวิทยาการคอมพิวเตอร์
Stack: React + Vite + Tailwind (`aimslog-frontend/frontend`) · Node/Express 5 + Mongoose 9 (`backend`) · MongoDB Atlas
Deploy: Frontend บน Vercel, Backend บน Render

## Requirement สำคัญ (จากการสัมภาษณ์ user — ห้ามขัด)
- ทำให้ **เล็กที่สุด**: เก็บครุภัณฑ์ + ดูว่าใครถือ/อยู่ที่ไหน + รายงาน
- **เลขครุภัณฑ์ซ้ำกันได้** → `assetCode` ไม่ unique, ใช้ `_id` เป็นตัวระบุชิ้น (และเป็นค่าใน QR)
- รูปแบบเลข: `วทท-8พ-57-1/80` หรือ `วทท-8พ-69-1-70` = คณะ 8, งบ พ, ปี 57, ชิ้นที่ 1 จาก 80 (`backend/src/utils/assetCode.js`)
- งบปัจจุบัน: `พ` = งบพิเศษ, `กท` = งบกองทุนค่าธรรมเนียม · งบเก่า (งบคลัง, งบรายได้หน่วยงาน) **ห้ามแปลง/ห้ามลบ** —
  ตาราง `budgets` (ตัวย่อ → ชื่องบ) Admin เพิ่มตัวย่อที่ไม่รู้จักตอน Import
- สถานะ 6 แบบ (key ใน `backend/src/constants/status.js` ต้องตรงกับ `frontend/src/data/statusConfig.js`):
  `ok` ปกติ · `broken` ชำรุด (ซ่อมได้) · `disposal` รอจำหน่าย (ซ่อมไม่ได้) · `unneeded` หมดความจำเป็น · `transferred` ตัดโอน · `missing` ไม่พบพัสดุ
- รายงานหน้าแรกมี 4 กลุ่ม: ปกติ / ชำรุด (แยกซ่อมได้-ซ่อมไม่ได้) / หมดความจำเป็น / ไม่พบ — ตัดโอนแสดงแยก ไม่นับในยอดสาขา
- ผู้ถือครอง: `holderName` (ข้อความ — อาจารย์ไม่มีบัญชี) + `holderUser` (ถ้ามีบัญชี)
- เก็บค่าดิบจาก Excel ไว้ใน `legacy` เสมอ
- สิทธิ์: `admin` (เจ้าหน้าที่พัสดุ) แก้ไขได้ทุกอย่าง, `user` ดูได้ · กรรมการตรวจนับเป็นสิทธิ์รายรอบ ไม่ใช่ role ถาวร
- เปลี่ยนสถานที่/ผู้ถือ: Admin เป็นคนแก้ และระบบบันทึกประวัติ (ไม่ทำ workflow ขออนุมัติ — งานในอนาคต)

## ข้อตกลงทางเทคนิค
- Auth: JWT ใน **httpOnly cookie** `token` + CSRF double-submit (`csrfToken` cookie ↔ header `X-CSRF-Token`), อายุ 8 ชม.
  Postman ใช้ `Authorization: Bearer` ได้ · Frontend เรียก `/api` ผ่าน proxy โดเมนเดียวกัน
  (dev: `vite.config.js` proxy → :4000, prod: `vercel.json` rewrites → Render)
- Response ของ asset ใช้ชื่อฟิลด์ฝั่ง Frontend (`code, cat, room, owner, ...`) — แปลงใน `backend/src/services/assetDto.js`
- Import 2 ขั้น: `POST /api/assets/import/preview` (ไม่บันทึก) → `POST /api/assets/import` (บันทึก, ข้ามรายการที่เลข+ชื่อซ้ำกับในระบบ)
- Real-time ตรวจนับใช้ polling ไม่ใช้ WebSocket
- Export Excel ทำฝั่ง Frontend (`xlsx`), PDF ใช้การพิมพ์ของเบราว์เซอร์ (ภาษาไทยไม่ต้องฝังฟอนต์)

## คำสั่ง
```bash
cd backend && npm install && cp .env.example .env   # ใส่ MONGO_URI, JWT_SECRET
npm run seed     # สร้าง admin/staff (รหัส 123456) + ตารางงบ
npm run dev      # API ที่ :4000
npm test         # unit + HTTP tests (ไม่ต้องใช้ DB)
node samples/make-sample.js   # สร้างไฟล์ตัวอย่างสำหรับทดสอบ Import

cd aimslog-frontend/frontend && npm install && npm run dev   # :5173
```

## แผน 4 สัปดาห์
1. พื้นฐาน + Import ✅ (branch `feature/week1-foundation`)
2. ตรวจนับ (Inspection รอบ + InspectionItem, กรรมการ, polling, self-check) + หน้าพิมพ์ QR ✅
3. รายงาน (summary/detail API, Export Excel, พิมพ์ PDF) + UAT กับพี่เป้
4. แก้บัค + ทำรูปเล่ม (หยุดเพิ่มฟีเจอร์)
