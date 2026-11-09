// สคริปต์กู้รหัสผ่านฉุกเฉิน (เช่น Admin คนเดียวลืมรหัส)
//
//   npm run reset-password -- <username>     ตั้งรหัสชั่วคราวให้บัญชีนั้น
//   npm run reset-password                    แสดงรายชื่อบัญชี Admin
//
// ความปลอดภัย:
// - รันได้เฉพาะเครื่องที่มี MONGO_URI ใน .env (คนที่เข้าฐานข้อมูลได้อยู่แล้ว) — ไม่มี API บนเว็บ
// - ไม่รับรหัสใหม่ทาง command line (กันรหัสค้างใน history) — สุ่มรหัสชั่วคราวให้และแสดงครั้งเดียว
// - ต้องพิมพ์ yes ยืนยันก่อน และบัญชีต้องเปลี่ยนรหัสทันทีที่ login ครั้งถัดไป
// - ปลดล็อกบัญชี และปิด MFA ให้ (กรณีทำมือถือหายด้วย)
require("dotenv").config();
require("../config/dns");
const crypto = require("crypto");
const readline = require("readline/promises");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User");

// ตัดตัวอักษรที่สับสนง่ายออก (0/O, 1/l/I)
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
function tempPassword(len = 12) {
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join("");
}

async function main() {
  const username = process.argv[2];
  if (!process.env.MONGO_URI) throw new Error("ไม่พบ MONGO_URI ใน .env");
  await mongoose.connect(process.env.MONGO_URI);

  if (!username) {
    const admins = await User.find({ role: "admin" }, { username: 1, name: 1, active: 1 }).lean();
    console.log("บัญชี Admin ทั้งหมด:");
    for (const a of admins) console.log(`  - ${a.username}  (${a.name})${a.active === false ? "  [ปิดบัญชีอยู่]" : ""}`);
    console.log("\nวิธีใช้: npm run reset-password -- <username>");
    return;
  }

  const user = await User.findOne({ username: String(username).trim() });
  if (!user) throw new Error(`ไม่พบบัญชี "${username}"`);

  console.log(`\nบัญชี: ${user.username}`);
  console.log(`ชื่อ:  ${user.name}`);
  console.log(`สิทธิ์: ${user.role === "admin" ? "Admin (เจ้าหน้าที่พัสดุ)" : "ผู้ใช้ทั่วไป"}`);
  if (user.active === false) console.log("สถานะ: ปิดบัญชีอยู่ — จะถูกเปิดใช้งานด้วย");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nตั้งรหัสผ่านชั่วคราวให้บัญชีนี้? พิมพ์ "yes" เพื่อยืนยัน: ');
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("ยกเลิก — ไม่มีอะไรเปลี่ยนแปลง");
    return;
  }

  const temp = tempPassword();
  user.password = await bcrypt.hash(temp, 10);
  user.mustChangePassword = true;
  user.passwordResetAt = new Date();
  user.active = true;
  user.failedLogins = 0;
  user.lockedUntil = undefined;
  if (user.mfaEnabled) {
    // ลืมรหัสมักมาพร้อมทำมือถือหาย — ปิด MFA ให้ แล้วให้เปิดใหม่หลังเข้าระบบได้
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaBackupCodes = [];
    console.log("ปิด MFA ของบัญชีนี้แล้ว — เปิดใหม่ได้ที่หน้าโปรไฟล์หลังเข้าระบบ");
  }
  await user.save();

  console.log("\n✅ ตั้งรหัสชั่วคราวแล้ว (แสดงครั้งเดียว — จดไว้ก่อนปิดหน้าต่าง)");
  console.log(`\n    ${temp}\n`);
  console.log("login ด้วยรหัสนี้ แล้วระบบจะบังคับให้ตั้งรหัสใหม่ทันที");
}

main()
  .catch((e) => {
    console.error("ผิดพลาด:", e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
