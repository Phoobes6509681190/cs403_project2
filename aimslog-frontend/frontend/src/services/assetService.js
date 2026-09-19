import api from './api'

// Sprint 2: CRUD ครุภัณฑ์ + ค้นหา/กรอง + ประวัติการเปลี่ยนแปลง

export function getAssets(params = {}) {
  // params: { q, status, room, budget, page, perPage }
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

// Soft delete — backend ไม่ลบจริง แค่ซ่อน (ตามสเปก Sprint 2)
export function deleteAsset(id) {
  return api.delete(`/assets/${id}`).then((res) => res.data)
}

// Sprint 3: นำเข้าข้อมูลจาก Excel
export function importAssets(formData, mappingOverrides) {
  if (mappingOverrides) formData.append('mappingOverrides', JSON.stringify(mappingOverrides))
  return api
    .post('/assets/import', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then((res) => res.data)
}
