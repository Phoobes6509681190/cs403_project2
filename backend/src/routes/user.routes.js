const express = require("express");
const { protect, requireRole, requireEditor } = require("../middleware/auth.middleware");
const c = require("../controllers/user.controller");

const router = express.Router();
router.use(protect);
const admin = requireRole("admin");

// รายชื่อผู้ใช้: เจ้าหน้าที่ต้องใช้เลือกกรรมการ/ผู้ถือครอง (ได้ข้อมูลแบบย่อ) ส่วนอื่นผู้ดูแลระบบเท่านั้น
router.get("/", requireEditor, c.list);
router.use(admin);
router.post("/", c.create);
router.put("/:id", c.update);
router.put("/:id/password", c.resetPassword);
router.put("/:id/mfa-reset", c.resetMfa);
router.put("/:id/unlock", c.unlock);

module.exports = router;
