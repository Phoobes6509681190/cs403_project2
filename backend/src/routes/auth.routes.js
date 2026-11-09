const express = require("express");
const { authMiddleware } = require("../middleware/auth.middleware");
const { login, logout, me } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", login);
// logout ไม่ต้องผ่าน auth — ถ้า token หมดอายุแล้วก็ยังต้องลบ cookie ได้
router.post("/logout", logout);
router.get("/me", authMiddleware, me);

module.exports = router;
