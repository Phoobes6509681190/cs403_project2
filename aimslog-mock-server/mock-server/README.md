# Mock Server — ไว้ทดสอบ Frontend เท่านั้น

⚠️ **ห้ามเอาไปใช้งานจริง** ไม่มี database, รหัสผ่านเก็บเป็น plain text, รีสตาร์ทแล้วข้อมูลหายหมด
สร้างมาเพื่อให้ทดสอบว่า UI/flow การล็อกอินทำงานถูกต้องระหว่างรอ backend ตัวจริง

## วิธีรัน

เปิด terminal อีกอันแยกจาก frontend (ต้องรันพร้อมกันทั้งคู่):

```bash
cd aimslog-mock-server
npm install
npm run start
```

จะขึ้นข้อความ:
```
✅ Mock server พร้อมใช้งานที่ http://localhost:4000
```

จากนั้นไปที่โฟลเดอร์ frontend เช็คว่า `.env` มี:
```
VITE_API_BASE_URL=http://localhost:4000/api
```

แล้ว `npm run dev` ตามปกติ เปิด http://localhost:5173 ล็อกอินด้วย:

| Username | Password | สิทธิ์ |
|---|---|---|
| `admin` | `admin123` | admin (เห็นเมนูครบ รวมนำเข้า Excel + แต่งตั้งกรรมการ) |
| `user` | `user123` | user (เมนูจำกัดกว่า ทดสอบ RoleRoute ว่าบล็อกจริง) |

## ทดสอบอะไรได้บ้าง

- Login / Logout จริง (เห็น cookie httpOnly ใน DevTools → Application → Cookies)
- ProtectedRoute: ลอง logout แล้วพิมพ์ URL `/dashboard` ตรงๆ ต้องเด้งกลับ `/login`
- RoleRoute: ล็อกอินด้วย `user` แล้วพิมพ์ URL `/assets/import` ตรงๆ ต้องเด้งไปหน้า 403
- ค้นหา/กรอง/เพิ่ม/แก้ไข/ลบครุภัณฑ์ (เฉพาะ admin เพิ่ม/แก้/ลบได้)
- นำเข้า Excel (ลองสร้างไฟล์ .xlsx มีคอลัมน์ "ชื่อครุภัณฑ์" กับ "สถานะ" ใส่คำแปลกๆ ในสถานะ
  แล้วดูว่าระบบให้ map เองไหม)
- แต่งตั้งกรรมการ → เริ่มรอบตรวจนับ → กดปุ่มสถานะ → progress bar ขยับ (polling ทุก 3 วิ) → ปิดรอบ
- หน้ารายงาน กราฟ/ตาราง และปุ่ม export (จะได้ไฟล์ตัวอย่างเปล่าๆ ไม่ใช่ Excel/PDF จริง
  เพราะ mock server ไม่ได้ generate ไฟล์จริง แค่ทดสอบว่า flow ดาวน์โหลดทำงาน)

## ข้อจำกัดที่ควรรู้

- CSRF/cookie ตั้งเป็น `secure: false, sameSite: 'lax'` เพราะรันบน `http://localhost` —
  ของจริงตอน deploy ต้องเปลี่ยนเป็น `secure: true, sameSite: 'strict'` (มีคอมเมนต์กำกับไว้ใน `server.js`)
- ไม่มี rate limiting ตอน login (ของจริง backend ควรทำ ป้องกัน brute force)
- Export Excel/PDF เป็นไฟล์ปลอม ไม่ใช่ของจริง
