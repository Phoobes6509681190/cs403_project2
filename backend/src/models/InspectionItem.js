const mongoose = require("mongoose");
const { STATUS_KEYS } = require("../constants/status");

// ผลตรวจรายชิ้นในแต่ละรอบ — สร้างล่วงหน้าทุกชิ้นตอนเปิดรอบ (result = null คือยังไม่ตรวจ)
const inspectionItemSchema = new mongoose.Schema(
  {
    inspection: { type: mongoose.Schema.Types.ObjectId, ref: "Inspection", required: true },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: "Asset", required: true },
    // สำเนาข้อมูลตอนเปิดรอบ — รายงานย้อนหลังยังถูกต้องแม้ครุภัณฑ์ถูกแก้ภายหลัง
    snapshot: {
      code: String,
      name: String,
      room: String,
      holderName: String,
      budget: String,
      statusBefore: String
    },
    holderUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    result: { type: String, enum: [...STATUS_KEYS, null], default: null },
    note: { type: String, trim: true },
    checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    checkedByName: String,
    checkedAt: Date,
    // committee = กรรมการ/เจ้าหน้าที่ตรวจ, self = ผู้ถือครองยืนยันเอง
    method: { type: String, enum: ["committee", "self"] }
  },
  { timestamps: true }
);

// 1 ชิ้นต่อ 1 รอบ — กดซ้ำ/เน็ตกระตุกก็ไม่เกิดรายการซ้ำ
inspectionItemSchema.index({ inspection: 1, asset: 1 }, { unique: true });

module.exports = mongoose.model("InspectionItem", inspectionItemSchema);
