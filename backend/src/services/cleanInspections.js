// ล้างรอบตรวจนับ (ใช้ล้างรอบที่เปิดไว้ทดสอบก่อนใช้งานจริง) — เรียกจาก src/scripts/clean-inspections.js
//
// ต่อ 1 รอบ ทำ 4 อย่าง (ทำทีละรอบจากใหม่ไปเก่า เพื่อให้สถานะย้อนกลับถูกลำดับ):
//   1. คืนสถานะครุภัณฑ์เป็นค่าก่อนเปิดรอบ (snapshot.statusBefore)
//      — เฉพาะชิ้นที่สถานะปัจจุบันยังเป็นผลจากรอบนี้ ถ้า Admin แก้เองภายหลังจะไม่ทับ
//   2. ลบประวัติแบบ "inspect" ที่รอบนี้สร้าง (ของชิ้นในรอบ ในช่วงเวลาที่รอบเปิดอยู่)
//   3. ลบผลตรวจรายชิ้น (InspectionItem) และตัวรอบ (Inspection)
//   4. คำนวณ "ตรวจล่าสุด" (lastInspectedAt) ใหม่จากรอบที่เหลือ
const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");
const Inspection = require("../models/Inspection");
const InspectionItem = require("../models/InspectionItem");

async function summarize(inspection) {
  const [total, checked] = await Promise.all([
    InspectionItem.countDocuments({ inspection: inspection._id }),
    InspectionItem.countDocuments({ inspection: inspection._id, result: { $ne: null } })
  ]);
  return { total, checked };
}

async function cleanOne(inspection, { restoreStatus = true } = {}) {
  const items = await InspectionItem.find({ inspection: inspection._id }).lean();
  const assetIds = items.map((i) => i.asset);
  let restored = 0;

  if (restoreStatus) {
    for (const it of items) {
      if (!it.result || !it.snapshot?.statusBefore || it.result === it.snapshot.statusBefore) continue;
      const r = await Asset.updateOne(
        { _id: it.asset, status: it.result },
        { status: it.snapshot.statusBefore }
      );
      restored += r.modifiedCount;
    }
  }

  const until = inspection.closedAt || new Date();
  const hist = await AssetHistory.deleteMany({
    asset: { $in: assetIds },
    action: "inspect",
    createdAt: { $gte: inspection.createdAt, $lte: until }
  });
  const del = await InspectionItem.deleteMany({ inspection: inspection._id });
  await Inspection.deleteOne({ _id: inspection._id });

  // ตรวจล่าสุด = เวลาตรวจล่าสุดจากรอบที่ยังเหลืออยู่ (ไม่มีก็ล้างค่า)
  const latest = await InspectionItem.aggregate([
    { $match: { asset: { $in: assetIds }, checkedAt: { $ne: null } } },
    { $group: { _id: "$asset", at: { $max: "$checkedAt" } } }
  ]);
  const latestMap = new Map(latest.map((l) => [String(l._id), l.at]));
  const checkedIds = items.filter((i) => i.checkedAt).map((i) => i.asset);
  for (const id of checkedIds) {
    const at = latestMap.get(String(id));
    await Asset.updateOne({ _id: id }, at ? { lastInspectedAt: at } : { $unset: { lastInspectedAt: 1 } });
  }

  return { items: del.deletedCount, history: hist.deletedCount, restored };
}

// ids = รายการ id ของรอบที่จะลบ — คืนผลรายรอบ
async function cleanInspections(ids, opts) {
  const rounds = await Inspection.find({ _id: { $in: ids } }).sort({ createdAt: -1 });
  const out = [];
  for (const r of rounds) out.push({ id: String(r._id), budgetYear: r.budgetYear, ...(await cleanOne(r, opts)) });
  return out;
}

module.exports = { cleanInspections, summarize };
