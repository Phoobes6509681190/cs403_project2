// ล้างรอบตรวจนับที่เปิดไว้ทดสอบ (ก่อนเริ่มใช้งานจริง)
//
//   npm run clean-inspections                    แสดงรายการรอบทั้งหมด (ไม่ลบอะไร)
//   npm run clean-inspections -- <id> [<id> ...] ลบรอบที่ระบุ
//   npm run clean-inspections -- --all           ลบทุกรอบ
//   เพิ่ม --keep-status ถ้าไม่ต้องการคืนสถานะครุภัณฑ์เป็นค่าก่อนเปิดรอบ
//
// ความปลอดภัย:
// - รันได้เฉพาะเครื่องที่มี MONGO_URI ใน .env — ไม่มีปุ่มหรือ API บนเว็บ (ผลตรวจจริงต้องลบไม่ได้)
// - แสดงสิ่งที่จะลบก่อน และต้องพิมพ์ "yes" ยืนยัน
// - ควรกด "สำรองข้อมูล" ในหน้าเว็บก่อนรัน
require("dotenv").config();
require("../config/dns");
const readline = require("readline/promises");
const mongoose = require("mongoose");
const Inspection = require("../models/Inspection");
const User = require("../models/User");
const { cleanInspections, summarize } = require("../services/cleanInspections");

const fmt = (d) => (d ? new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "-");

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const keepStatus = args.includes("--keep-status");
  const ids = args.filter((a) => !a.startsWith("--"));

  if (!process.env.MONGO_URI) throw new Error("ไม่พบ MONGO_URI ใน .env");
  await mongoose.connect(process.env.MONGO_URI);

  const rounds = await Inspection.find().sort({ createdAt: -1 }).lean();
  const users = await User.find({ _id: { $in: rounds.map((r) => r.createdBy) } }, { name: 1 }).lean();
  const nameOf = (id) => users.find((u) => String(u._id) === String(id))?.name || "-";

  console.log(`\nรอบตรวจนับทั้งหมด ${rounds.length} รอบ:`);
  for (const r of rounds) {
    const s = await summarize(r);
    console.log(
      `  ${r._id}  ปีงบ ${r.budgetYear}  ${r.status === "open" ? "[เปิดอยู่]" : "[ปิดแล้ว]"}  ` +
      `เปิดโดย ${nameOf(r.createdBy)} เมื่อ ${fmt(r.createdAt)}  ตรวจแล้ว ${s.checked}/${s.total}`
    );
  }

  if (!all && !ids.length) {
    console.log("\nวิธีใช้: npm run clean-inspections -- <id> [<id> ...]   หรือ   -- --all");
    return;
  }

  const targets = all ? rounds : rounds.filter((r) => ids.includes(String(r._id)));
  const unknown = ids.filter((id) => !rounds.some((r) => String(r._id) === id));
  if (unknown.length) throw new Error(`ไม่พบรอบ: ${unknown.join(", ")}`);
  if (!targets.length) return console.log("\nไม่มีรอบให้ลบ");

  console.log(`\nจะลบ ${targets.length} รอบ: ${targets.map((r) => `ปีงบ ${r.budgetYear} (${r._id})`).join(", ")}`);
  console.log(
    keepStatus
      ? "- สถานะครุภัณฑ์: คงไว้ตามผลตรวจ (--keep-status)"
      : "- สถานะครุภัณฑ์: คืนเป็นค่าก่อนเปิดรอบ (ยกเว้นชิ้นที่ Admin แก้เองภายหลัง)"
  );
  console.log("- ลบผลตรวจรายชิ้น และประวัติการตรวจของรอบเหล่านี้ (ย้อนกลับไม่ได้ — ควรกดสำรองข้อมูลก่อน)");
  if (targets.some((r) => r.status === "open")) console.log("- มีรอบที่ยังเปิดอยู่ จะถูกลบด้วย");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\nพิมพ์ "yes" เพื่อยืนยัน: ');
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") return console.log("ยกเลิก — ไม่มีการเปลี่ยนแปลง");

  const result = await cleanInspections(targets.map((r) => r._id), { restoreStatus: !keepStatus });
  console.log("\nเรียบร้อย:");
  for (const r of result) {
    console.log(`  ปีงบ ${r.budgetYear} (${r.id}): ลบผลตรวจ ${r.items} ชิ้น, ประวัติ ${r.history} รายการ, คืนสถานะ ${r.restored} ชิ้น`);
  }
}

main()
  .catch((e) => {
    console.error("ผิดพลาด:", e.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
