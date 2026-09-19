# AIMSlog Frontend — ระบบจัดการครุภัณฑ์

Frontend ครบตาม Sprint 0–5 ในแผนงาน (React + Vite + React Router + Axios + Tailwind)
เขียนโดยเน้นความปลอดภัยสำหรับระบบราชการ (ม.ธรรมศาสตร์) เป็นพิเศษ

## วิธีรัน

```bash
npm install
cp .env.example .env      # แล้วแก้ VITE_API_BASE_URL ให้ชี้ backend จริง
npm run dev
```

build ขึ้น production:

```bash
npm run build
npm run preview
```

---

## ⚠️ สิ่งสำคัญที่สุด: ต้องคุยกับเพื่อนที่ทำ Backend เพิ่มจากแผนเดิม

แผนเดิมเขียนว่า "เก็บ JWT ใน localStorage หรือ Cookie" — เราเลือก **httpOnly cookie**
เพราะ localStorage ถูกอ่านได้จาก JavaScript ทุกตัวในหน้า ถ้ามีช่องโหว่ XSS แม้จุดเดียว
ผู้ไม่หวังดีขโมย token ไปสวมรอยได้ทันที ซึ่งยอมรับความเสี่ยงนี้ไม่ได้กับระบบที่มีข้อมูลจริง

**ผลคือ backend ต้องทำเพิ่มจากสเปกเดิม:**

1. **`POST /api/auth/login`** — เมื่อ login สำเร็จ ให้เซ็ต cookie 2 ตัว แทนการคืน token เป็น JSON:
   ```
   Set-Cookie: token=<JWT>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=<วินาที>
   Set-Cookie: csrfToken=<random-string>; Secure; SameSite=Strict; Path=/; Max-Age=<วินาที>
   ```
   (`token` เป็น httpOnly ห้าม JS อ่าน, `csrfToken` **ไม่ httpOnly** เพราะ frontend ต้องอ่านมาแนบ header)
   response body คืนแค่ `{ user: { id, username, name, role } }` พอ ไม่ต้องมี token ปนมา

2. **`GET /api/auth/me`** — endpoint ใหม่ที่แผนเดิมไม่มี จำเป็นเพราะ frontend อ่าน httpOnly
   cookie เองไม่ได้ ต้องถาม backend ทุกครั้งที่โหลดแอปว่า "ตอนนี้ยังล็อกอินอยู่ไหม"
   คืน `{ user: {...} }` ถ้า cookie ยังใช้ได้ หรือ 401 ถ้าไม่ได้ล็อกอิน/หมดอายุ

3. **CSRF protection (double-submit cookie)** — ทุก request ที่แก้ไขข้อมูล (POST/PUT/PATCH/DELETE)
   frontend จะแนบ header `X-CSRF-Token` มาด้วยเสมอ backend ต้องเทียบค่านี้กับค่าใน
   cookie `csrfToken` ว่าตรงกันก่อนยอมรับ request — ถ้าไม่ตรงหรือไม่มีให้ตอบ 403

4. **CORS** ต้องตั้ง `credentials: true` และ `origin` เป็นโดเมนของ frontend แบบเจาะจง
   (ห้ามใช้ `origin: '*'` เด็ดขาด เพราะจะใช้คู่กับ cookie ไม่ได้ตามสเปก CORS)

5. **`POST /api/auth/logout`** — ต้อง clear ทั้งสอง cookie (set Max-Age=0)

6. **`GET /api/users`** — endpoint ใหม่ที่แผนเดิมไม่มีระบุไว้ชัด แต่จำเป็นสำหรับหน้า
   แต่งตั้งกรรมการ (Sprint 4) ต้องมีรายชื่อผู้ใช้ให้เลือก คืน `{ items: [{ id, username, name }] }`

7. **`GET /api/inspections/active`** — endpoint ใหม่ คืนรอบตรวจนับที่กำลังเปิดอยู่ (ถ้ามี)
   พร้อมรายการครุภัณฑ์ในรอบนั้น (`items: [{ assetId, code, name, room, status, checked }]`)
   ถ้าไม่มีรอบเปิดอยู่ให้คืน `204 No Content` หรือ `null`

**เรื่องอื่นที่ต้องคุยกัน (จากจุด "ต้องคุยกัน" ในแผนเดิม):**
- Token หมดอายุกี่ชั่วโมง → แนะนำ 8 ชั่วโมง (เท่ากับเวลาทำงาน 1 วัน) และให้ frontend
  auto-logout เองถ้าไม่มีการใช้งานเกิน 20 นาที (ทำไว้แล้วใน `AuthContext.jsx`)
- Role มีแค่ `admin` / `user` พอไหม หรือจะมี `committee` แยกอีกระดับ (ตอนนี้ frontend
  รองรับแค่ 2 ระดับ ใน `data/nav.js` และ `RoleRoute`)

---

## โครงสร้างโฟลเดอร์

```
src/
├── main.jsx              จุดเริ่มต้น (ห่อด้วย BrowserRouter + AuthProvider)
├── App.jsx               รวม routes ทั้งหมด + ProtectedRoute/RoleRoute
├── index.css             ตัวแปรสี ธีมสว่าง/มืด
│
├── context/
│   └── AuthContext.jsx   สถานะล็อกอิน, role, auto-logout เมื่อไม่ใช้งาน (idle timeout)
├── hooks/
│   ├── useAuth.js
│   ├── useDebounce.js    หน่วงค่าก่อนยิงค้นหา
│   └── usePolling.js     เรียกซ้ำเป็นช่วงๆ สำหรับ progress bar แบบ real-time
│
├── services/             ชั้นเรียก API ทั้งหมด (ไม่มีหน้าไหนเรียก axios ตรงๆ)
│   ├── api.js            axios instance + คำอธิบาย security เต็มๆ (อ่านก่อนแก้)
│   ├── authService.js
│   ├── assetService.js
│   ├── inspectionService.js
│   ├── reportService.js
│   └── userService.js
│
├── components/
│   ├── ProtectedRoute.jsx  บล็อกการเข้าถึงถ้ายังไม่ล็อกอิน
│   ├── RoleRoute.jsx       บล็อกตาม role (เช่นหน้า admin เท่านั้น)
│   ├── AppLayout.jsx       sidebar + topbar + logout confirm
│   ├── Sidebar.jsx / Topbar.jsx
│   ├── UI.jsx              Card, Btn, Modal, ConfirmDialog, Toast, ProgressBar ฯลฯ
│   └── icon.jsx / icons.js
│
├── data/                 ข้อมูล config ล้วนๆ ไม่มี logic
│   ├── nav.js            เมนู + role ที่มองเห็น
│   ├── statusConfig.js   สี/label ของสถานะครุภัณฑ์
│   └── titles.js
│
└── pages/
    ├── LoginPage.jsx
    ├── Dashboard.jsx
    ├── AssetListPage.jsx      Sprint 2: ค้นหา/กรอง/CRUD/badge สถานะ
    ├── AssetDetailPage.jsx    Sprint 2: รายละเอียด + ประวัติ
    ├── AssetImportPage.jsx    Sprint 3: นำเข้า Excel + preview + mapping
    ├── CommitteePage.jsx      Sprint 4: แต่งตั้งกรรมการ
    ├── InspectionPage.jsx     Sprint 4: ตรวจนับ + progress bar + ปิดรอบ
    └── ReportPage.jsx         Sprint 5: สรุป + รายละเอียด + export
```

## แนวทางความปลอดภัยที่ implement ไว้แล้ว

- **ไม่เก็บ JWT ใน localStorage** — ใช้ httpOnly cookie (ดูรายละเอียดเต็มใน `services/api.js`)
- **CSRF protection** ด้วย double-submit cookie pattern แนบอัตโนมัติทุก mutating request
- **ProtectedRoute** กันเข้าหน้าที่ต้องล็อกอินก่อน พร้อมรอผล session check จริงก่อนตัดสินใจ
  (กัน flash of protected content — เนื้อหาแวบออกมาก่อนเด้งไป login)
- **RoleRoute** กันหน้าที่ควรเป็นของ Admin เท่านั้น (นำเข้า Excel, แต่งตั้งกรรมการ) ไม่ใช่แค่ซ่อนเมนู
- **Auto-logout เมื่อไม่มีการใช้งาน 20 นาที** ป้องกันลืมออกจากระบบบนเครื่องที่ใช้ร่วมกัน
- **ข้อความ error ตอน login ไม่บอกว่า "username ผิด" หรือ "password ผิด"** แยกกัน
  (กัน user enumeration — คนร้ายไล่เดาว่า username ไหนมีอยู่จริง)
- **Soft delete** ที่ฝั่ง UI ก็เตือนผู้ใช้ชัดเจนว่าลบแล้วกู้คืนได้ (ไม่ใช่ลบถาวร)
- Dependency ภายนอกน้อยที่สุดเท่าที่จำเป็น (axios, react-router-dom, xlsx) —
  ยิ่งพึ่งพา library เยอะ ยิ่งเพิ่มช่องโหว่แบบ supply-chain

## สิ่งที่ยังต้องทำเพิ่มก่อนขึ้นใช้งานจริง (Sprint 6)

- ตั้งค่า `Content-Security-Policy` header ที่ฝั่ง hosting (Vercel) เพื่อลดผลกระทบถ้าเกิด XSS
- ทดสอบ Edge Case ตามสเปก Sprint 6 (ข้อมูลว่าง, network error — มี `LoadingState`/`ErrorState`
  รองรับไว้แล้วในเกือบทุกหน้า แต่ควรทดสอบจริงกับ backend)
- ตั้ง Environment Variable บน Vercel ให้ตรงกับ backend บน Render.com
- พิจารณาทำ code-splitting ลด bundle size (ตอนนี้ ~600KB ก่อน gzip เพราะ `xlsx` ค่อนข้างใหญ่)
