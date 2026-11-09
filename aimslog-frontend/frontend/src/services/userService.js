import api from './api'

export function getUsers(params = {}) {
  return api.get('/users', { params }).then((res) => res.data)
}

export function createUser(payload) {
  // payload: { username, name, password, role }
  return api.post('/users', payload).then((res) => res.data)
}

// Admin ตั้งรหัสใหม่ให้ผู้ใช้ที่ลืมรหัสผ่าน
export function resetUserPassword(userId, newPassword) {
  return api.put(`/users/${userId}/password`, { newPassword }).then((res) => res.data)
}

// เปลี่ยนสิทธิ์ / ปิด-เปิดบัญชี
export function updateUser(userId, payload) {
  return api.put(`/users/${userId}`, payload).then((res) => res.data)
}

// ปิด MFA ให้ผู้ใช้ที่ทำมือถือหาย / ปลดล็อกบัญชีที่ใส่รหัสผิดเกินกำหนด
export function resetUserMfa(userId) {
  return api.put(`/users/${userId}/mfa-reset`).then((res) => res.data)
}
export function unlockUser(userId) {
  return api.put(`/users/${userId}/unlock`).then((res) => res.data)
}

export function getLoginLogs(params = {}) {
  // params: { username, success, page, perPage }
  return api.get('/login-logs', { params }).then((res) => res.data)
}
