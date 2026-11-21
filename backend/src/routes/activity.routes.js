const express = require("express");
const { protect, requireRole } = require("../middleware/auth.middleware");
const c = require("../controllers/activity.controller");

const router = express.Router();
router.get("/", protect, requireRole("admin"), c.list);

module.exports = router;
