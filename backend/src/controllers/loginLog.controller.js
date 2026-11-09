const LoginLog = require("../models/LoginLog");
const escapeRegex = require("../utils/escapeRegex");

// GET /api/login-logs?username=&success=true|false&page=1&perPage=50 (admin)
exports.list = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const perPage = Math.min(200, Math.max(1, parseInt(req.query.perPage, 10) || 50));
    const filter = {};
    if (req.query.username) filter.username = new RegExp(escapeRegex(String(req.query.username).trim()), "i");
    if (req.query.success === "true") filter.success = true;
    if (req.query.success === "false") filter.success = false;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [items, total, failed24h] = await Promise.all([
      LoginLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * perPage).limit(perPage).lean(),
      LoginLog.countDocuments(filter),
      LoginLog.countDocuments({ success: false, createdAt: { $gte: since } })
    ]);
    res.json({
      success: true,
      total,
      page,
      perPage,
      failed24h,
      items: items.map((l) => ({
        id: String(l._id), username: l.username || "", success: l.success, reason: l.reason,
        ip: l.ip || "", userAgent: l.userAgent || "", at: l.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
