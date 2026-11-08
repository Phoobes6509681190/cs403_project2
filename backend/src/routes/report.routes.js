const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const c = require("../controllers/report.controller");

const router = express.Router();
router.use(protect);

// Export Excel/PDF ทำฝั่ง Frontend จากข้อมูล 2 endpoint นี้ (ไม่มี /export ที่ backend)
router.get("/summary", c.summary);
router.get("/detail", c.detail);

module.exports = router;
