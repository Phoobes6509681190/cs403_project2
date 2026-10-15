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