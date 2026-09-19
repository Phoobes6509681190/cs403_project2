import axios from 'axios'

// Sprint 0: ตั้งค่า Axios Base URL ให้ชี้ไปที่ Backend
// ใช้ environment variable เพื่อสลับระหว่าง local / staging / production ได้โดยไม่แก้โค้ด
// (ตั้งค่าจริงใน .env — ดู .env.example)
const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api'

/**
 * แนวทางความปลอดภัยของ token (สำคัญ อ่านก่อนแก้ไฟล์นี้):
 *
 * เราไม่เก็บ JWT ไว้ใน localStorage / sessionStorage ฝั่ง frontend เพราะ
 * ที่เก็บทั้งสองแบบนี้ JavaScript ใดๆ ในหน้าเว็บอ่านได้หมด ถ้ามีช่องโหว่ XSS
 * แม้แต่จุดเดียว (เช่น dependency ที่โดนแฮ็ก หรือลืม sanitize input ที่ไหนสักจุด)
 * ผู้ไม่หวังดีจะขโมย token ไปสวมรอยผู้ใช้ได้ทันที ซึ่งยอมรับความเสี่ยงนี้ไม่ได้
 * กับระบบราชการที่มีข้อมูลครุภัณฑ์และบัญชีผู้ใช้จริง
 *
 * แทนที่ด้วยการให้ backend เซ็ต JWT เป็น httpOnly cookie ตอน login สำเร็จ:
 *   Set-Cookie: token=...; HttpOnly; Secure; SameSite=Strict; Path=/
 * ฝั่ง frontend จะ "แตะต้อง token ไม่ได้เลย" — ส่งคำขอด้วย withCredentials: true
 * แล้ว browser จะแนบ cookie ให้เองอัตโนมัติ วิธีนี้ป้องกันการขโมย token ผ่าน XSS
 * ได้เกือบสมบูรณ์ (JS อ่าน httpOnly cookie ไม่ได้)
 *
 * เมื่อใช้ cookie แล้ว ความเสี่ยงที่ต้องกันเพิ่มคือ CSRF (เว็บอื่นสั่งให้ browser
 * ยิง request มาที่เราโดยใช้ cookie ที่ล็อกอินอยู่) — เรากันด้วย double-submit
 * cookie pattern: backend ส่ง CSRF token แบบไม่ httpOnly มาให้ตอน login/refresh
 * (อ่านได้จาก cookie ชื่อ csrfToken) แล้ว frontend แนบค่านั้นกลับไปใน header
 * X-CSRF-Token ทุกครั้งที่ทำ POST/PUT/PATCH/DELETE — backend เทียบค่าที่ได้จาก
 * cookie กับ header ต้องตรงกันเท่านั้นถึงจะยอมรับคำขอ
 *
 * ผลคือ endpoint ที่เพื่อนทำ backend ต้องรองรับเพิ่มจากสเปกเดิม:
 *   - CORS ต้องตั้ง credentials: true และ origin เจาะจงโดเมน frontend (ห้ามใช้ '*')
 *   - login ต้องเซ็ต cookie สองตัว: token (httpOnly) และ csrfToken (ไม่ httpOnly)
 *   - ต้องมี endpoint GET /api/auth/me ให้ frontend เรียกตอนโหลดแอปเพื่อเช็คว่า
 *     ยังล็อกอินอยู่ไหม (เพราะ frontend อ่าน cookie httpOnly เองไม่ได้)
 */

export const api = axios.create({
  baseURL,
  withCredentials: true, // แนบ cookie (httpOnly token + csrfToken) ไปกับทุก request โดยอัตโนมัติ
  timeout: 15000,
})

// อ่านค่าจาก cookie ที่ไม่ใช่ httpOnly (เฉพาะ csrfToken เท่านั้นที่ frontend อ่านได้)
function readCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

// แนบ CSRF token อัตโนมัติกับทุกคำสั่งที่แก้ไขข้อมูล (กัน CSRF ตามที่อธิบายด้านบน)
api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    const csrfToken = readCookie('csrfToken')
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

// จุดกลางสำหรับแจ้ง AuthContext เมื่อ token หมดอายุ/ไม่ผ่านการยืนยันตัวตน
// ใช้ callback แทนการ import AuthContext ตรงๆ เพื่อไม่ให้เกิด circular import
let onUnauthorized = () => {}
export function registerUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    if (status === 401) {
      // token หมดอายุ หรือไม่ได้ล็อกอิน — เคลียร์ state แล้วเด้งไปหน้า login
      onUnauthorized()
    }
    return Promise.reject(error)
  }
)

export default api
