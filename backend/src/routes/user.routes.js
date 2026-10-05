const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireAdmin = require("../middleware/role.middleware");
const { createUser, getUsers } = require("../controllers/user.controller");

const router = express.Router();

router.use(authMiddleware);
router.get("/", getUsers);
router.post("/", requireAdmin, createUser);

module.exports = router;
