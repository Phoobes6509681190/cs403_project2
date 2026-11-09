import api from './api'

// Sprint 2: CRUD ครุภัณฑ์ + ค้นหา/กรอง + ประวัติการเปลี่ยนแปลง

export function getAssets(params = {}) {
  // params: { q, status, room, budget, page, perPage }
  // คืน { items, total, page, perPage, rooms, budgets }
  return api.get('/assets', { params }).then((res) => res.data)
}

export function getAsset(id) {
  return api.get(`/assets/${id}`).then((res) => res.data)
}

export function getAssetHistory(id) {
  return api.get(`/assets/${id}/history`).then((res) => res.data)
}

export function createAsset(payload) {
  return api.post('/assets', payload).then((res) => res.data)
}

export function updateAsset(id, payload) {
  return api.put(`/assets/${id}`, payload).then((res) => res.data)
}

// Soft delete — backend ไม่ลบจริง แค่ซ่อน
export function deleteAsset(id) {
  return api.delete(`/assets/${id}`).then((res) => res.data)
}

export function getBudgets() {
  return api.get('/budgets').then((res) => res.data)
}

// Sprint 3: นำเข้าข้อมูลจาก Excel (2 ขั้น: ตรวจก่อน แล้วค่อยบันทึก)
export function previewImport(file) {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/assets/import/preview', fd).then((res) => res.data)
}

export function commitImport(file, { statusMapping = {}, budgetMapping = {} } = {}) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('statusMapping', JSON.stringify(statusMapping))
  fd.append('budgetMapping', JSON.stringify(budgetMapping))
  return api.post('/assets/import', fd).then((res) => res.data)
}

export async function downloadImportTemplate() {
  const res = await api.get('/assets/import/template', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'aimslog-template.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

// ถังขยะ: รายการที่ถูกลบ (soft delete) และการกู้คืน
export function getTrash() {
  return api.get('/assets/trash').then((res) => res.data)
}

export function restoreAsset(id) {
  return api.post(`/assets/${id}/restore`).then((res) => res.data)
}

// สำรองข้อมูลทั้งระบบเป็นไฟล์ Excel
export async function downloadBackup() {
  const res = await api.get('/backup', { responseType: 'blob', timeout: 60000 })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = `aimslog-backup-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}
