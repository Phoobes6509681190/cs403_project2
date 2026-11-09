const express = require("express");
const { authMiddleware, protect } = require("../middleware/auth.middleware");
const { login, logout, me, changePassword, updateProfile } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", login);
// logout ไม่ต้องผ่าน auth — ถ้า token หมดอายุแล้วก็ยังต้องลบ cookie ได้
router.post("/logout", logout);
router.get("/me", authMiddleware, me);
router.put("/password", protect, changePassword);
router.put("/profile", protect, updateProfile);

module.exports = router;
