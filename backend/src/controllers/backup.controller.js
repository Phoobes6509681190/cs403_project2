const XLSX = require("xlsx");
const Asset = require("../models/Asset");
const AssetHistory = require("../models/AssetHistory");
const Budget = require("../models/Budget");
const User = require("../models/User");
const Inspection = require("../models/Inspection");
const InspectionItem = require("../models/InspectionItem");
const { STATUSES } = require("../constants/status");

const d = (v) => (v ? new Date(v).toISOString().replace("T", " ").slice(0, 19) : "");
const label = (k) => STATUSES[k]?.label || k || "";

// GET /api/backup (admin) — ดาวน์โหลดข้อมูลทั้งระบบเป็น Excel (รวมรายการในถังขยะ, ไม่รวมรหัสผ่าน)
// Atlas แบบฟรีไม่สำรองข้อมูลอัตโนมัติ — แนะนำให้กดทุกเดือนและก่อน Import ทุกครั้ง
exports.download = async (req, res) => {
  try {
    const [assets, history, budgets, users, rounds, items] = await Promise.all([
      Asset.find().lean(),
      AssetHistory.find().sort({ createdAt: 1 }).lean(),
      Budget.find().lean(),
      User.find({}, { password: 0, avatar: 0 }).lean(),
      Inspection.find().lean(),
      InspectionItem.find({ result: { $ne: null } }).lean()
    ]);
    const roundYear = new Map(rounds.map((r) => [String(r._id), r.budgetYear]));

    const sheets = {
      "ครุภัณฑ์": assets.map((a) => ({
        id: String(a._id), "เลขครุภัณฑ์": a.assetCode, "ชื่อ": a.name, "ยี่ห้อ": a.brand, "รุ่น": a.model,
        "ประเภท": a.category, "งบประมาณ": a.budget, "อาคาร": a.location?.building, "ชั้น": a.location?.floor,
        "ห้อง": a.location?.room, "สถานที่": a.location?.label, "ผู้ถือครอง": a.holderName,
        "บัญชีผู้ถือครอง": a.holderUser ? String(a.holderUser) : "", "ราคา": a.price, "สถานะ": label(a.status),
        "ตรวจล่าสุด": d(a.lastInspectedAt), "อยู่ในถังขยะ": a.isDeleted ? "ใช่" : "",
        "สร้างเมื่อ": d(a.createdAt), "แก้ไขล่าสุด": d(a.updatedAt), "ข้อมูลเดิมจาก Excel": a.legacy ? JSON.stringify(a.legacy) : ""
      })),
      "ประวัติ": history.map((h) => ({
        "เวลา": d(h.createdAt), asset: String(h.asset), "การกระทำ": h.action, "โดย": h.changedByName,
        "รายละเอียด": (h.changes || []).map((c) => `${c.field}: ${c.oldValue ?? ""} → ${c.newValue ?? ""}`).join("; ")
      })),
      "ผลตรวจนับ": items.map((i) => ({
        "ปีงบ": roundYear.get(String(i.inspection)), asset: String(i.asset), "เลขครุภัณฑ์": i.snapshot?.code,
        "ชื่อ": i.snapshot?.name, "ผล": label(i.result), "ตรวจโดย": i.checkedByName,
        "วิธี": i.method === "self" ? "ผู้ถือครองยืนยัน" : "กรรมการ", "เวลา": d(i.checkedAt)
      })),
      "งบประมาณ": budgets.map((b) => ({ "ตัวย่อ": b.abbr, "ชื่องบ": b.name, "ใช้อยู่": b.active ? "ใช่" : "งบเดิม" })),
      "ผู้ใช้": users.map((u) => ({
        id: String(u._id), username: u.username, "ชื่อ": u.name, "สิทธิ์": u.role, "ตำแหน่ง": u.position,
        "อีเมล": u.email, "สถานะบัญชี": u.active === false ? "ปิด" : "ใช้งาน"
      }))
    };

    const wb = XLSX.utils.book_new();
    for (const [name, rows] of Object.entries(sheets)) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "ไม่มีข้อมูล" }]), name);
    }
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="aimslog-backup-${date}.xlsx"`);
    res.send(buf);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
