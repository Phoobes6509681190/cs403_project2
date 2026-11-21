const express = require("express");
const { protect, requireRole, requireEditor } = require("../middleware/auth.middleware");
const upload = require("../middleware/upload.middleware");
const asset = require("../controllers/asset.controller");
const importer = require("../controllers/import.controller");

const router = express.Router();
router.use(protect);

// admin = ผู้ดูแลระบบ (ลบ/ถังขยะ), editor = ผู้ดูแลระบบ + ผู้ใช้/เจ้าหน้าที่ (เพิ่ม/แก้ไข/นำเข้า)
const admin = requireRole("admin");
const editor = requireEditor;

// Import ต้องอยู่ก่อน /:id ไม่งั้น "import" จะถูกมองเป็น id
router.get("/import/template", editor, importer.template);
router.post("/import/preview", editor, upload.single("file"), importer.preview);
router.post("/import", editor, upload.single("file"), importer.commit);

router.get("/trash", admin, asset.getTrash);
router.delete("/trash", admin, asset.emptyTrash);
router.get("/", asset.getAssets);
router.get("/options", asset.getOptions);
router.post("/", editor, asset.createAsset);
router.post("/qr-printed", editor, asset.markQrPrinted);
router.post("/bulk-delete", admin, asset.bulkDelete);
router.get("/:id", asset.getAsset);
router.get("/:id/history", asset.getAssetHistory);
router.put("/:id", editor, asset.updateAsset);
router.delete("/:id", admin, asset.deleteAsset);
router.post("/:id/restore", admin, asset.restoreAsset);
router.delete("/:id/permanent", admin, asset.purgeAsset);

module.exports = router;
