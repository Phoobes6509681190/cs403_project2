const Asset = require("../models/Asset");
const InspectionItem = require("../models/InspectionItem");

// สถานะเดิมที่เลิกใช้ -> สถานะปัจจุบัน
// "รอจำหน่าย" (disposal) ไม่มีในไฟล์ของคณะ — รวมเป็น "ชำรุด" ตาม feedback UAT
const RENAMED = { disposal: "broken" };

// ปรับข้อมูลเดิมในฐานข้อมูลให้ใช้สถานะปัจจุบัน — เรียกตอนเปิดเซิร์ฟเวอร์ (ทำซ้ำได้ ไม่มีผลถ้าไม่มีอะไรต้องแก้)
// ใช้ updateMany ตรง ๆ เพราะ enum ใน Model ไม่มีค่าเดิมแล้ว (save() จะไม่ผ่าน validation)
async function migrateStatuses() {
  const out = {};
  for (const [from, to] of Object.entries(RENAMED)) {
    const [a, r, s] = await Promise.all([
      Asset.collection.updateMany({ status: from }, { $set: { status: to } }),
      InspectionItem.collection.updateMany({ result: from }, { $set: { result: to } }),
      InspectionItem.collection.updateMany({ "snapshot.statusBefore": from }, { $set: { "snapshot.statusBefore": to } })
    ]);
    out[from] = { assets: a.modifiedCount, results: r.modifiedCount, snapshots: s.modifiedCount };
  }
  return out;
}

module.exports = { migrateStatuses, RENAMED };
