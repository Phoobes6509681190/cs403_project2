const mongoose = require("mongoose");

const assetHistorySchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true
    },
    
    changedBy: {
        type: String,
        required: true
    },
    changes: [
      {
        field: {
            type: String,
            required: true
            },


    oldValue: {
      type: mongoose.Schema.Types.Mixed
            },


    newValue: {
      type: mongoose.Schema.Types.Mixed
            }
        }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("AssetHistory", assetHistorySchema);