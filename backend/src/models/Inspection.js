const mongoose = require("mongoose");

const inspectionItemSchema = new mongoose.Schema(
  {
    asset: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Asset",
      required: true
    },

    status: {
      type: String,
      enum: ["normal", "damaged", "lost", "disposed"],
    },

    note: {
      type: String,
      trim: true
    },

    inspectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },

    inspectedAt: {
      type: Date
    }
  },
  {
    _id: true
  }
);

const inspectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    fiscalYear: {
      type: String,
      required: true
    },

    status: {
      type: String,
      enum: ["draft", "in_progress", "closed"],
      default: "draft"
    },

    committee: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],

    items: [inspectionItemSchema],

    startedAt: {
      type: Date
    },

    closedAt: {
      type: Date
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Inspection", inspectionSchema);