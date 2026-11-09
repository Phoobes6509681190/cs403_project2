const Inspection = require("../models/Inspection");
const InspectionItem = require("../models/InspectionItem");

// ผลตรวจที่เลือกได้ (ตัดโอนไม่ใช่ผลจากการตรวจ — เป็นการเปลี่ยนสถานะโดย Admin)
const INSPECT_RESULTS = ["ok", "broken", "disposal", "unneeded", "missing"];

const getOpenInspection = () => Inspection.findOne({ status: "open" }).sort({ createdAt: -1 });

// กรรมการ = ผู้ที่ถูกแต่งตั้งในรอบนี้เท่านั้น — Admin ไม่ได้เป็นกรรมการอัตโนมัติ
// ("คนซื้อกับคนตรวจต้องเป็นคนละคน" และกันเจ้าหน้าที่เผลอกดผลแทนกรรมการ)
const isCommittee = (inspection, user) =>
  inspection.committee.some((id) => String(id) === String(user?.userId));

// เห็นรายการทั้งหมดของรอบ: กรรมการ หรือ Admin (ดูความคืบหน้าอย่างเดียว)
const canViewAll = (inspection, user) => user?.role === "admin" || isCommittee(inspection, user);

// ตรวจชิ้นนี้ได้ไหม: กรรมการรอบนี้ / ผู้ถือครองที่ผูกบัญชีไว้ (self-check)
const canInspectItem = (inspection, item, user) =>
  inspection.status === "open" &&
  (isCommittee(inspection, user) || (item?.holderUser && String(item.holderUser) === String(user?.userId)));

async function progressOf(inspectionId) {
  const rows = await InspectionItem.aggregate([
    { $match: { inspection: inspectionId } },
    { $group: { _id: { result: "$result", method: "$method" }, n: { $sum: 1 } } }
  ]);
  const out = { total: 0, checked: 0, selfChecked: 0, byResult: {} };
  for (const r of rows) {
    out.total += r.n;
    if (r._id.result) {
      out.checked += r.n;
      out.byResult[r._id.result] = (out.byResult[r._id.result] || 0) + r.n;
      if (r._id.method === "self") out.selfChecked += r.n;
    }
  }
  out.percent = out.total ? Math.round((out.checked / out.total) * 100) : 0;
  return out;
}

module.exports = { INSPECT_RESULTS, getOpenInspection, isCommittee, canViewAll, canInspectItem, progressOf };
