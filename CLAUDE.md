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
- สถานะ (key ใน `backend/src/constants/status.js` ต้องตรงกับ `frontend/src/data/statusConfig.js`):
  `ok` ปกติ · `broken` ชำรุด (ซ่อมได้) · `disposal` รอจำหน่าย (ซ่อมไม่ได้) · `unneeded` หมดความจำเป็น · `transferred` ตัดโอน · `missing` ไม่พบพัสดุ
  + ปัญหาข้อมูลจากไฟล์คณะ (เก็บตามไฟล์ ไม่แปลง): `duplicate` ข้อมูลซ้ำ · `dataerror` ข้อมูลบางส่วนผิด · `notours` ไม่ใช่ครุภัณฑ์หน่วยงาน
  ชื่อที่แสดงใช้คำตามไฟล์คณะ: `unneeded` = เสื่อมสภาพ, `missing` = หาไม่พบ, `transferred` = จำหน่ายแล้ว · ปัญหาข้อมูลแสดงบนจอแต่ไม่ออกในรายงานที่พิมพ์/ส่งออก
- รายงานหน้าแรกมี 4 กลุ่ม: ปกติ / ชำรุด (แยกซ่อมได้-ซ่อมไม่ได้) / หมดความจำเป็น / ไม่พบ — ตัดโอนและปัญหาข้อมูลแสดงแยก ไม่นับในยอดสาขา ไม่เข้ารอบตรวจ (`NOT_COUNTED`)
- งบประมาณหลักจากตัวย่อในเลขครุภัณฑ์ (แยกงบพิเศษ/กองทุนได้) · "แหล่งเงิน" เก็บแยกใน `fundSource` และใช้แทนเมื่อเลขไม่มีตัวย่อ
- Import: เลือกได้หลายชีต + จับคู่คอลัมน์เอง (แต่ละปีชื่อคอลัมน์ไม่เหมือนกัน เช่น ปี 68 เลขอยู่ใน "Ref No. 1")
- ผู้ถือครอง: `holderName` (ข้อความ — อาจารย์ไม่มีบัญชี) + `holderUser` (ถ้ามีบัญชี)
- เก็บค่าดิบจาก Excel ไว้ใน `legacy` เสมอ
- สิทธิ์ 3 ระดับ (`backend/src/constants/roles.js`, ตาม UAT): `admin` ผู้ดูแลระบบ (ไม่ใช่พี่เป้) ทำได้ทุกอย่างรวมลบ/ถังขยะ/ผู้ใช้ ·
  `staff` ผู้ใช้ = เจ้าหน้าที่พัสดุ เพิ่ม/แก้ไข/นำเข้า/QR/เปิด-ปิดรอบ แต่ลบไม่ได้ · `user` ผู้ดูข้อมูล (อาจารย์) ดูอย่างเดียว
  กรรมการตรวจนับเป็นสิทธิ์รายรอบ ไม่ใช่ role ถาวร · ถังขยะเห็นเฉพาะของที่ตัวเองลบ
- เปลี่ยนสถานที่/ผู้ถือ: Admin เป็นคนแก้ และระบบบันทึกประวัติ (ไม่ทำ workflow ขออนุมัติ — งานในอนาคต)

## ข้อตกลงทางเทคนิค
- Auth: JWT ใน **httpOnly cookie** `token` + CSRF double-submit (`csrfToken` cookie ↔ header `X-CSRF-Token`), อายุ 8 ชม.
  ล็อกบัญชีเมื่อผิด 5 ครั้ง (15 นาที) + จำกัดต่อ IP, บันทึก `LoginLog` (180 วัน), MFA แบบ TOTP (otplib) + รหัสสำรอง,
  `mustChangePassword` สำหรับรหัสชั่วคราว — JWT ที่มี `purpose` (เช่น mfa) ใช้เป็น session ไม่ได้
  Postman ใช้ `Authorization: Bearer` ได้ · Frontend เรียก `/api` ผ่าน proxy โดเมนเดียวกัน
  (dev: `vite.config.js` proxy → :4000, prod: `vercel.json` rewrites → Render)
- Response ของ asset ใช้ชื่อฟิลด์ฝั่ง Frontend (`code, cat, room, owner, ...`) — แปลงใน `backend/src/services/assetDto.js`
- Import 2 ขั้น: `POST /api/assets/import/preview` (เทียบกับระบบ: ใหม่ / ตรงกัน / ต่างกัน / หายจากไฟล์) → `POST /api/assets/import` (เพิ่มใหม่ + อัปเดตให้ตรงกับไฟล์, ค่าเดิมเก็บในประวัติ)
- Real-time ตรวจนับใช้ polling ไม่ใช้ WebSocket
- Export Excel ทำฝั่ง Frontend (`xlsx`), PDF ใช้การพิมพ์ของเบราว์เซอร์ (ภาษาไทยไม่ต้องฝังฟอนต์)

## คำสั่ง
```bash
cd backend && npm install && cp .env.example .env   # ใส่ MONGO_URI, JWT_SECRET
npm run seed     # สร้าง admin/staff (รหัส 123456 — บังคับเปลี่ยนตอน login ครั้งแรก) + ตารางงบ
npm run reset-password -- <username>   # กู้รหัสฉุกเฉิน: สุ่มรหัสชั่วคราว + บังคับเปลี่ยนตอน login
npm run clean-inspections [-- <id>|--all]  # ล้างรอบตรวจนับทดสอบ (คืนสถานะก่อนเปิดรอบ) — ไม่ใส่ argument = แค่แสดงรายการ
npm run dev      # API ที่ :4000
npm test         # unit + HTTP + integration (integration ใช้ MongoDB ชั่วคราว — ครั้งแรกดาวน์โหลดตัว MongoDB, เปิดไม่ได้จะข้าม)
node samples/make-sample.js   # สร้างไฟล์ตัวอย่างสำหรับทดสอบ Import

cd aimslog-frontend/frontend && npm install && npm run dev   # :5173
```

## แผน 4 สัปดาห์
1. พื้นฐาน + Import ✅ (branch `feature/week1-foundation`)
2. ตรวจนับ (Inspection รอบ + InspectionItem, กรรมการ, polling, self-check) + หน้าพิมพ์ QR ✅
3. รายงาน (summary/detail API, Export Excel, พิมพ์ PDF) ✅ + UAT กับพี่เป้
4. แก้บัค + ทำรูปเล่ม (หยุดเพิ่มฟีเจอร์)
