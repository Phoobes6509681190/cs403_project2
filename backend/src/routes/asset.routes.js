const express = require("express");
const { protect, requireRole } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const asset = require("../controllers/asset.controller");
const importer = require("../controllers/import.controller");

const router = express.Router();
router.use(protect);

const admin = requireRole("admin");

// Import ต้องอยู่ก่อน /:id ไม่งั้น "import" จะถูกมองเป็น id
router.get("/import/template", admin, importer.template);
router.post("/import/preview", admin, upload.single("file"), importer.preview);
router.post("/import", admin, upload.single("file"), importer.commit);

router.get("/", asset.getAssets);
router.post("/", admin, asset.createAsset);
router.get("/:id", asset.getAsset);
router.get("/:id/history", asset.getAssetHistory);
router.put("/:id", admin, asset.updateAsset);
router.delete("/:id", admin, asset.deleteAsset);

module.exports = router;
