const mongoose = require("mongoose");

const assetSchema = new mongoose.Schema(
  {
    assetCode: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: true,
      trim: true
    },

    location: {
      type: String,
      required: true,
      trim: true
    },

    purchaseDate: {
      type: Date
    },

    price: {
      type: Number,
      min: 0
    },

    budgetSource: {
      type: String,
      trim: true
    },

    originalBudgetSource: {
      type: String,
      trim: true
    },

    status: {
      type: String,
      enum: [
        "normal",
        "damaged",
        "lost",
        "disposed"
      ],
      default: "normal"
    },

    originalStatus: {
    type: String,
    trim: true
    },

    description: {
      type: String,
      trim: true
    },

    responsiblePerson: {
      type: String,
      trim: true
    },

    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Asset", assetSchema);