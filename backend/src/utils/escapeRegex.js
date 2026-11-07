// กันไม่ให้ข้อความค้นหาของผู้ใช้กลายเป็น regex (เช่นพิมพ์ "(" แล้ว server error หรือ ReDoS)
module.exports = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
