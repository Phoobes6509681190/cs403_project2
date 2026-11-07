// สร้างข้อมูลเริ่มต้น: ผู้ใช้ทดสอบ + ตารางงบประมาณ
// รัน: npm run seed   (รันซ้ำได้ ไม่สร้างซ้ำ — ถ้ามี user อยู่แล้วจะไม่เปลี่ยนรหัสผ่าน)
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const { ensureDefaultBudgets } = require("./services/budget.service");

const USERS = [
  { username: "admin", name: "เจ้าหน้าที่พัสดุ (ทดสอบ)", role: "admin", password: process.env.SEED_ADMIN_PASSWORD || "123456" },
  { username: "staff", name: "บุคลากร (ทดสอบ)", role: "user", password: process.env.SEED_USER_PASSWORD || "123456" }
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await ensureDefaultBudgets();
  for (const u of USERS) {
    const exists = await User.findOne({ username: u.username });
    if (exists) {
      console.log(`- ${u.username} มีอยู่แล้ว (ข้าม)`);
      continue;
    }
    await User.create({ ...u, password: await bcrypt.hash(u.password, 10) });
    console.log(`+ สร้าง ${u.username} (${u.role})`);
  }
  console.log("เสร็จแล้ว — อย่าลืมเปลี่ยนรหัสผ่านก่อนใช้งานจริง");
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
