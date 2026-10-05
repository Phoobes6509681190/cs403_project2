const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
const requireAdmin = require("../middleware/role.middleware");
const upload = require("../middleware/upload.middleware");
 

const {
  getAssets,
  getAssetById,
  createAsset,
  updateAsset,
  deleteAsset,
  searchAssets,
  getAssetHistory,
  importAssets,
  previewAssetImport,
  confirmAssetImport,
  downloadImportTemplate
} = require("../controllers/asset.controller");

router.use(authMiddleware);

router.post("/import", requireAdmin, upload.single("file"), importAssets);
router.post("/import/preview", requireAdmin, upload.single("file"), previewAssetImport);
router.post("/import/confirm", requireAdmin, confirmAssetImport);
router.get("/import/template", requireAdmin, downloadImportTemplate);

router.get("/", getAssets);

router.post("/", requireAdmin, createAsset);

router.get("/search", searchAssets);

router.get("/:id/history", getAssetHistory);
router.get("/:id", getAssetById);

router.put("/:id", requireAdmin, updateAsset);

router.delete("/:id", requireAdmin, deleteAsset);



module.exports = router;