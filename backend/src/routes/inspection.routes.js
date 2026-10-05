const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const {
  createInspection,
  getInspections,
  getInspection,
  setCommittee,
  recordInspectionItem,
  getInspectionProgress,
  closeInspection
} = require("../controllers/inspection.controller");

router.use(authMiddleware);

router.get("/", getInspections);
router.post("/", createInspection);
router.put("/:id/committee", setCommittee);
router.post("/:id/items", recordInspectionItem);
router.get("/:id/progress", getInspectionProgress);
router.put("/:id/close", closeInspection);
router.get("/:id", getInspection);

module.exports = router;