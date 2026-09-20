const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");
 

const {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  searchAssets,
  getAssetHistory
} = require("../controllers/asset.controller");

router.use(authMiddleware);


router.get("/", getAssets);

router.post("/", createAsset);

router.get("/search", searchAssets);

router.get("/:id/history", getAssetHistory);

router.put("/:id", updateAsset);

router.delete("/:id", deleteAsset);

module.exports = router;