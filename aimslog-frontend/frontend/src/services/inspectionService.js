import api from './api'

// Sprint 4: รอบตรวจนับครุภัณฑ์

// คืนรอบตรวจนับที่กำลังเปิดอยู่ตอนนี้ (ถ้ามี) — ใช้ตอนเปิดหน้า /inspection
export function getActiveInspection() {
  return api.get('/inspections/active').then((res) => res.data)
}

export function createInspection(payload) {
  // payload: { budgetYear, committee: [{ userId, role }] }
  return api.post('/inspections', payload).then((res) => res.data)
}

export function getInspection(id) {
  return api.get(`/inspections/${id}`).then((res) => res.data)
}

export function submitInspectionItem(inspectionId, assetId, status, note) {
  return api
    .post(`/inspections/${inspectionId}/items`, { assetId, status, note })
    .then((res) => res.data)
}

// เรียกซ้ำเป็นช่วงๆ (polling) เพื่อดูความคืบหน้าแบบเกือบเรียลไทม์
// โดยไม่ต้องเปิด WebSocket — ดูเหตุผลเลือกใช้ polling ใน README
export function getInspectionProgress(id) {
  return api.get(`/inspections/${id}/progress`).then((res) => res.data)
}

export function closeInspection(id) {
  return api.put(`/inspections/${id}/close`).then((res) => res.data)
}

export function appointCommittee(inspectionId, members) {
  return api.post(`/inspections/${inspectionId}/committee`, { members }).then((res) => res.data)
}
