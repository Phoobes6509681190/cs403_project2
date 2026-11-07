const mongoose = require("mongoose");

const assetHistorySchema = new mongoose.Schema(
  {
    asset: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true, index: true },
    // เอามาจาก JWT (req.user) เท่านั้น — ไม่รับจาก req.body กันการปลอมชื่อ
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    changedByName: { type: String },
    action: { type: String, enum: ["create", "update", "delete", "import", "inspect"], default: "update" },
    changes: [
      {
        field: { type: String, required: true },
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("AssetHistory", assetHistorySchema);
