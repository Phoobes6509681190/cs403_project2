// เขียนเองสั้นๆ แทนการลง npm package เพิ่ม (jwt-decode ฯลฯ)
// เพื่อลดจำนวน dependency จากภายนอก — ยิ่งพึ่งพา library น้อย ยิ่งลดช่องโหว่ supply-chain
//
// ⚠️ ฟังก์ชันนี้ "ไม่ได้ตรวจลายเซ็น" ของ token เพียงแค่ถอดอ่านข้อมูลเพื่อเอาไปแสดงผล
// (เช่น เวลาหมดอายุ, role) การยืนยันตัวตนจริงต้องทำที่ backend ทุกครั้งเสมอ
// ห้าม frontend เชื่อ role หรือ exp จากตรงนี้เพื่อตัดสินใจด้านความปลอดภัยเด็ดขาด
// ใช้แค่ "ปรับ UI ให้สอดคล้อง" เช่น ซ่อนเมนู หรือเตือนก่อน token หมดอายุ

export function decodeJwt(token) {
  if (!token || typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    )
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function getTokenExpiryMs(token) {
  const payload = decodeJwt(token)
  if (!payload?.exp) return null
  return payload.exp * 1000
}

export function isTokenExpired(token) {
  const expMs = getTokenExpiryMs(token)
  if (!expMs) return true
  return Date.now() >= expMs
}
