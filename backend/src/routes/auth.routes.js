const express = require("express");
const { authMiddleware, protect } = require("../middleware/auth.middleware");
const c = require("../controllers/auth.controller");
const { login, logout, me, changePassword, updateProfile } = c;

const router = express.Router();

router.post("/login", login);
// logout ไม่ต้องผ่าน auth — ถ้า token หมดอายุแล้วก็ยังต้องลบ cookie ได้
router.post("/logout", logout);
router.get("/me", authMiddleware, me);
router.put("/password", protect, changePassword);
router.put("/profile", protect, updateProfile);

// ยืนยัน 2 ขั้นตอน (MFA)
router.post("/mfa/verify", c.mfaVerify); // ขั้นที่ 2 ของการ login (ยังไม่มี session)
router.post("/mfa/setup", protect, c.mfaSetup);
router.post("/mfa/enable", protect, c.mfaEnable);
router.post("/mfa/disable", protect, c.mfaDisable);
router.post("/mfa/backup-codes", protect, c.mfaBackupCodes);

module.exports = router;
