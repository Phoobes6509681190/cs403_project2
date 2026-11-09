import api from './api'

// Sprint 1: เรียก API login ผ่าน Axios
// หมายเหตุ: response ไม่คืน token กลับมาให้ frontend อ่านตรงๆ
// เพราะ backend เซ็ต token เป็น httpOnly cookie ให้แล้ว (ดูเหตุผลใน services/api.js)
// response body คืนแค่ข้อมูลผู้ใช้ (username, role, ...) มาแสดงผลเท่านั้น
export function login(username, password) {
  return api.post('/auth/login', { username, password }).then((res) => res.data)
}

export function logout() {
  return api.post('/auth/logout').then((res) => res.data)
}

// เรียกตอนโหลดแอปทุกครั้ง เพื่อเช็คว่า cookie ที่มีอยู่ยังใช้ล็อกอินได้ไหม
// (frontend อ่าน httpOnly cookie เองไม่ได้ ต้องถามฝั่ง backend เสมอ)
export function fetchMe() {
  return api.get('/auth/me').then((res) => res.data)
}

export function changePassword(currentPassword, newPassword) {
  return api.put('/auth/password', { currentPassword, newPassword }).then((res) => res.data)
}

export function updateProfile(payload) {
  // payload: { name, position, email, phone, bio, avatar }
  return api.put('/auth/profile', payload).then((res) => res.data)
}

// ---------- ยืนยัน 2 ขั้นตอน (MFA) ----------
export function verifyMfa(mfaToken, code) {
  return api.post('/auth/mfa/verify', { mfaToken, code }).then((res) => res.data)
}
export function mfaSetup() {
  return api.post('/auth/mfa/setup').then((res) => res.data)
}
export function mfaEnable(code) {
  return api.post('/auth/mfa/enable', { code }).then((res) => res.data)
}
export function mfaDisable(password) {
  return api.post('/auth/mfa/disable', { password }).then((res) => res.data)
}
export function mfaNewBackupCodes(password) {
  return api.post('/auth/mfa/backup-codes', { password }).then((res) => res.data)
}
