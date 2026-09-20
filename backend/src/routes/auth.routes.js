const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const {
  login,
  logout
} = require("../controllers/auth.controller");

router.post("/login", login);
router.post("/logout", authMiddleware, logout);

module.exports = router;