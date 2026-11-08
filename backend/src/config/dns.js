// แก้ปัญหา "querySrv ECONNREFUSED" บน Windows / เครือข่ายมหาวิทยาลัย
// ที่ DNS ในเครื่องไม่ตอบ SRV record ของ mongodb+srv://
// ตั้ง DNS_SERVERS=8.8.8.8,1.1.1.1 ใน .env เพื่อให้ Node ใช้ DNS สาธารณะแทน
const dns = require("dns");

const servers = (process.env.DNS_SERVERS || "").split(",").map((s) => s.trim()).filter(Boolean);
if (servers.length) dns.setServers(servers);
