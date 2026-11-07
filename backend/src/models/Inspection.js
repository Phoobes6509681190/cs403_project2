const mongoose = require("mongoose");

const inspectionSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true
    },

    inspector: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    condition: {
      type: String,
      enum: [
        "good",
        "fair",
        "damaged",
        "missing"
      ],
      required: true
    },

    note: {
      type: String
    },

    inspectedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// TODO สัปดาห์ 2: แยกเป็น Inspection (รอบ) + InspectionItem (ผลรายชิ้น)
module.exports = mongoose.model("Inspection", inspectionSchema);
