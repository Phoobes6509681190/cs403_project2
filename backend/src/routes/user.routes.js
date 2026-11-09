const express = require("express");
const { protect, requireRole } = require("../middleware/auth.middleware");
const c = require("../controllers/user.controller");

const router = express.Router();
router.use(protect, requireRole("admin"));

router.get("/", c.list);
router.post("/", c.create);
router.put("/:id", c.update);
router.put("/:id/password", c.resetPassword);

module.exports = router;
