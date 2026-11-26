const Inspection = require("../models/Inspection");
const InspectionItem = require("../models/InspectionItem");

// ผลตรวจที่เลือกได้ — "จำหน่ายแล้ว" และ "หาไม่พบ" ต้องใส่หมายเหตุ (ตาม feedback UAT)
const INSPECT_RESULTS = ["ok", "broken", "unneeded", "transferred", "missing"];
const NOTE_REQUIRED = ["transferred", "missing"];

const getOpenInspection = () => Inspection.findOne({ status: "open" }).sort({ createdAt: -1 });

// กรรมการ = ผู้ที่ถูกแต่งตั้งในรอบนี้เท่านั้น — Admin ไม่ได้เป็นกรรมการอัตโนมัติ
// ("คนซื้อกับคนตรวจต้องเป็นคนละคน" และกันเจ้าหน้าที่เผลอกดผลแทนกรรมการ)
const isCommittee = (inspection, user) =>
  inspection.committee.some((id) => String(id) === String(user?.userId));

// เห็นรายการของรอบ: ผู้ดูแลระบบ + เจ้าหน้าที่ — ผู้ใช้ปกติ (อาจารย์) ไม่เกี่ยวกับการตรวจนับ
const canViewAll = (inspection, user) => ["admin", "staff"].includes(user?.role);

// บันทึกผลตรวจได้ไหม (ตาม feedback UAT รอบ 2: ผู้ใช้ปกติตรวจของตัวเองไม่ได้แล้ว)
//   ผู้ดูแลระบบ: ได้เสมอ (ทำได้ทุกอย่าง) · เจ้าหน้าที่: เฉพาะที่ถูกแต่งตั้งเป็นกรรมการรอบนี้ · ผู้ใช้ปกติ: ไม่ได้
const canInspectItem = (inspection, item, user) =>
  inspection.status === "open" &&
  (user?.role === "admin" || (user?.role === "staff" && isCommittee(inspection, user)));

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

module.exports = { INSPECT_RESULTS, NOTE_REQUIRED, getOpenInspection, isCommittee, canViewAll, canInspectItem, progressOf };
