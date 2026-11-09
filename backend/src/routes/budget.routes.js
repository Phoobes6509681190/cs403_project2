const express = require("express");
const Budget = require("../models/Budget");
const { protect } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(protect);

// GET /api/budgets — ตาราง Mapping ตัวย่อ -> ชื่องบ
router.get("/", async (req, res) => {
  try {
    const items = await Budget.find().sort({ active: -1, abbr: 1 }).lean();
    res.json({ success: true, items: items.map(({ _id, abbr, name, active }) => ({ id: String(_id), abbr, name, active })) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
