import api from './api'

// Sprint 5: รายงานสรุปและส่งออกไฟล์

export function getReportSummary(params = {}) {
  return api.get('/reports/summary', { params }).then((res) => res.data)
}

export function getReportDetail(params = {}) {
  return api.get('/reports/detail', { params }).then((res) => res.data)
}

// ไฟล์ export เป็น binary (excel/pdf) ต้องขอ responseType: 'blob'
// แล้วสร้างลิงก์ดาวน์โหลดฝั่ง client เอง เพราะ backend ส่งเป็นไฟล์ตรงๆ ไม่ใช่ JSON
export async function exportReport(format, params = {}) {
  const res = await api.get('/reports/export', {
    params: { ...params, format },
    responseType: 'blob',
  })

  const filename = `aimslog-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`
  const url = window.URL.createObjectURL(new Blob([res.data]))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
