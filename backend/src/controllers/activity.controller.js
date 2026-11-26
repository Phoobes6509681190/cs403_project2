const AssetHistory = require("../models/AssetHistory");
const Asset = require("../models/Asset");
const escapeRegex = require("../utils/escapeRegex");
const { toHistoryDto } = require("../services/assetDto");

const ACTIONS = ["create", "update", "delete", "restore", "import", "inspect"];

// GET /api/activity?action=&by=&q=&from=&to=&group=1&page=1&perPage=50 (ผู้ดูแลระบบ)
// บันทึกกิจกรรมรวมทุกครุภัณฑ์ — ใครทำอะไร (เพิ่ม/แก้ไข/ลบ/กู้คืน/นำเข้า/ตรวจ) เมื่อไหร่
exports.list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.perPage, 10) || 50));
    const filter = {};
    if (ACTIONS.includes(req.query.action)) filter.action = req.query.action;
    if (req.query.by) filter.changedByName = new RegExp(escapeRegex(String(req.query.by).trim()), "i");
    const range = {};
    if (req.query.from && !isNaN(Date.parse(req.query.from))) range.$gte = new Date(req.query.from);
    if (req.query.to && !isNaN(Date.parse(req.query.to))) range.$lte = new Date(new Date(req.query.to).getTime() + 86399999);
    if (Object.keys(range).length) filter.createdAt = range;
    if (req.query.q) {
      const rx = new RegExp(escapeRegex(String(req.query.q).trim()), "i");
      const ids = await Asset.find({ $or: [{ assetCode: rx }, { name: rx }] }, { _id: 1 }).limit(2000).lean();
      filter.asset = { $in: ids.map((a) => a._id) };
    }

    // group=1 (ค่าเริ่มต้นของหน้าเว็บ): สรุปรวม "ใคร ทำอะไร วันไหน กี่ชิ้น ล่าสุดเมื่อไหร่"
    // นำเข้าครั้งเดียวอาจเป็นหมื่นแถว — ไม่ต้องไล่ดูทีละรายการ (feedback UAT)
    if (req.query.group === "1") {
      const [out] = await AssetHistory.aggregate([
        { $match: filter },
        {
          $group: {
            _id: {
              by: "$changedByName",
              action: "$action",
              day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Bangkok" } }
            },
            count: { $sum: 1 },
            first: { $min: "$createdAt" },
            last: { $max: "$createdAt" }
          }
        },
        { $sort: { last: -1 } },
        { $facet: { rows: [{ $skip: (page - 1) * perPage }, { $limit: perPage }], total: [{ $count: "n" }] } }
      ]);
      return res.json({
        success: true,
        grouped: true,
        total: out.total[0]?.n || 0,
        page,
        perPage,
        items: out.rows.map((g) => ({
          by: g._id.by || "",
          action: g._id.action,
          day: g._id.day,
          count: g.count,
          first: g.first,
          last: g.last
        }))
      });
    }

    const [rows, total] = await Promise.all([
      AssetHistory.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage)
        .populate("asset", "assetCode name").lean(),
      AssetHistory.countDocuments(filter)
    ]);
    res.json({
      success: true,
      total,
      page,
      perPage,
      items: rows.map((h) => ({
        ...toHistoryDto(h),
        asset: h.asset ? { id: String(h.asset._id), code: h.asset.assetCode || "", name: h.asset.name || "" } : null
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
