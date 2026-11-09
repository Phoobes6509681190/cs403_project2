const Asset = require("../models/Asset");
const Budget = require("../models/Budget");
const Inspection = require("../models/Inspection");
const InspectionItem = require("../models/InspectionItem");
const { STATUS_KEYS } = require("../constants/status");
const { toAssetDto } = require("../services/assetDto");
const { progressOf } = require("../services/inspection.service");

const fail = (res, code, message) => res.status(code).json({ success: false, message });

function baseFilter(q) {
  const f = { isDeleted: false };
  if (q.budget) f.budget = String(q.budget);
  if (q.room) f["location.label"] = String(q.room);
  return f;
}

// GET /api/reports/summary?budget=&room=
// หน้าแรกของรายงาน: จำนวนแยกตามงบ × สถานะ
//   - ยอดรวมของสาขา "ไม่นับ" ของที่ตัดโอนแล้ว (แสดงแยกเป็นคอลัมน์ transferred)
//   - ชำรุดแยก ซ่อมได้ (broken) / ซ่อมไม่ได้ (disposal)
exports.summary = async (req, res) => {
  try {
    const filter = baseFilter(req.query);
    const [rows, rooms, budgets, latest] = await Promise.all([
      Asset.aggregate([
        { $match: filter },
        { $group: { _id: { budget: "$budget", status: "$status" }, n: { $sum: 1 } } }
      ]),
      Asset.aggregate([
        { $match: { ...filter, status: { $ne: "transferred" } } },
        { $group: { _id: "$location.label", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Budget.find().lean(),
      Inspection.findOne().sort({ createdAt: -1 }).lean()
    ]);

    const activeByName = new Map(budgets.map((b) => [b.name, b.active]));
    const empty = () => Object.fromEntries([...STATUS_KEYS.map((k) => [k, 0]), ["total", 0]]);
    const byBudget = new Map();
    const byStatus = Object.fromEntries(STATUS_KEYS.map((k) => [k, 0]));

    for (const r of rows) {
      const name = r._id.budget || "ไม่ระบุ";
      if (!byBudget.has(name)) byBudget.set(name, empty());
      const g = byBudget.get(name);
      g[r._id.status] = (g[r._id.status] || 0) + r.n;
      if (r._id.status !== "transferred") g.total += r.n;
      byStatus[r._id.status] = (byStatus[r._id.status] || 0) + r.n;
    }

    // งบปัจจุบันขึ้นก่อน ตามด้วยงบในอดีต แล้วเรียงตามชื่อ
    const groups = [...byBudget.entries()]
      .map(([budget, g]) => ({ budget, active: activeByName.get(budget) ?? false, ...g }))
      .sort((a, b) => Number(b.active) - Number(a.active) || a.budget.localeCompare(b.budget, "th"));

    const totals = empty();
    for (const g of groups) for (const k of Object.keys(totals)) totals[k] += g[k];

    let inspection = null;
    if (latest) {
      inspection = {
        id: String(latest._id),
        budgetYear: latest.budgetYear,
        status: latest.status,
        closedAt: latest.closedAt || null,
        closedBy: latest.closedBy ? (await require("../models/User").findById(latest.closedBy, { name: 1 }).lean())?.name || "" : "",
        closeReason: latest.closeReason || "",
        progress: await progressOf(latest._id)
      };
    }

    res.json({
      success: true,
      generatedAt: new Date(),
      total: totals.total, // ไม่รวมตัดโอน
      transferred: totals.transferred,
      byStatus,
      groups,
      totals,
      byRoom: rooms.map((r) => ({ room: r._id || "ไม่ระบุ", count: r.count })),
      inspection
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// GET /api/reports/detail?budget=&room=&status=
// ตารางรายละเอียดทุกชิ้น + ผลตรวจในรอบล่าสุด
exports.detail = async (req, res) => {
  try {
    const filter = baseFilter(req.query);
    if (req.query.status && STATUS_KEYS.includes(req.query.status)) filter.status = req.query.status;

    const [assets, latest] = await Promise.all([
      Asset.find(filter)
        .sort({ budget: 1, "location.label": 1, "codeParts.year": 1, "codeParts.total": 1, "codeParts.seq": 1 })
        .lean(),
      Inspection.findOne().sort({ createdAt: -1 }).lean()
    ]);

    const checked = new Map();
    if (latest) {
      const items = await InspectionItem.find(
        { inspection: latest._id, result: { $ne: null } },
        { asset: 1, result: 1, checkedByName: 1, checkedAt: 1 }
      ).lean();
      for (const it of items) checked.set(String(it.asset), it);
    }

    res.json({
      success: true,
      inspectionYear: latest?.budgetYear || null,
      items: assets.map((a) => {
        const it = checked.get(String(a._id));
        return {
          ...toAssetDto(a),
          inspectedInRound: !!it,
          inspectedBy: it?.checkedByName || ""
        };
      })
    });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
