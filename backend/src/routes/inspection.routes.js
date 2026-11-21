const express = require("express");
const { protect, requireEditor } = require("../middleware/auth.middleware");
const c = require("../controllers/inspection.controller");

const router = express.Router();
router.use(protect);
// เปิด/ปิดรอบ และแต่งตั้งกรรมการ: ผู้ดูแลระบบ + ผู้ใช้/เจ้าหน้าที่
const admin = requireEditor;

router.get("/", c.list);
router.get("/active", c.active);
router.post("/", admin, c.create);
router.get("/:id", c.get);
router.get("/:id/progress", c.progress);
router.post("/:id/items", c.submitItem);
router.post("/:id/bulk", c.bulkRoom); // สิทธิ์ตรวจละเอียดใน controller (กรรมการ / ผู้ถือครอง)
router.put("/:id/close", admin, c.close);
router.post("/:id/committee", admin, c.setCommittee);

module.exports = router;
