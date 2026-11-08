import api from './api'

// รายงานสรุปและรายละเอียด — Export Excel / PDF ทำฝั่ง Frontend (ดู utils/reportExport.js)
export function getReportSummary(params = {}) {
  return api.get('/reports/summary', { params }).then((res) => res.data)
}

export function getReportDetail(params = {}) {
  return api.get('/reports/detail', { params }).then((res) => res.data)
}
