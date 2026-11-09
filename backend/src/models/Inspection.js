const mongoose = require("mongoose");

// รอบตรวจนับประจำปี — เปิดได้ทีละ 1 รอบ
// กรรมการเป็นสิทธิ์ "รายรอบ" (แต่ละปีไม่ซ้ำกัน) ไม่ใช่ role ถาวรของ user
const inspectionSchema = new mongoose.Schema(
  {
    budgetYear: { type: Number, required: true }, // ปีงบประมาณ พ.ศ. เช่น 2569
    status: { type: String, enum: ["open", "closed"], default: "open", index: true },
    committee: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    totalItems: { type: Number, default: 0 },
    closedAt: Date,
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Inspection", inspectionSchema);
