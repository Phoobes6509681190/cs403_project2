const express = require("express");
const { protect, requireRole } = require("../middleware/auth.middleware");
const c = require("../controllers/backup.controller");

const router = express.Router();
router.get("/", protect, requireRole("admin"), c.download);

module.exports = router;
