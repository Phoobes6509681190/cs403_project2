const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { getReportSummary, getReportDetail, exportReport } = require("../controllers/report.controller");

const router = express.Router();

router.use(authMiddleware);
router.get("/summary", getReportSummary);
router.get("/detail", getReportDetail);
router.get("/export", exportReport);

module.exports = router;