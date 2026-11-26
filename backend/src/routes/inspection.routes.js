const express = require("express");
const { protect, requireRole, requireEditor } = require("../middleware/auth.middleware");
const c = require("../controllers/inspection.controller");

const router = express.Router();
router.use(protect);
// แต่งตั้งกรรมการ (= เปิดรอบ / แก้รายชื่อ): ผู้ดูแลระบบเท่านั้น — ปิดรอบ: ผู้ดูแลระบบ + เจ้าหน้าที่
const admin = requireRole("admin");
const editor = requireEditor;

router.get("/", c.list);
router.get("/active", c.active);
router.post("/", admin, c.create);
router.get("/:id", c.get);
router.get("/:id/progress", c.progress);
router.post("/:id/items", c.submitItem);
router.post("/:id/bulk", c.bulkRoom); // สิทธิ์ตรวจละเอียดใน controller (ผู้ดูแลระบบ / เจ้าหน้าที่ที่เป็นกรรมการ)
router.put("/:id/close", editor, c.close);
router.post("/:id/committee", admin, c.setCommittee);

module.exports = router;
