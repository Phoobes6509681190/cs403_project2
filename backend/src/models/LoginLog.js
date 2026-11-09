const mongoose = require("mongoose");

// ประวัติการเข้าสู่ระบบ — ใช้ตรวจย้อนหลังว่ามีใครพยายามเข้าบัญชีไหน เมื่อไหร่ จากที่ไหน
// เก็บ 180 วันแล้วลบอัตโนมัติ (TTL index)
const loginLogSchema = new mongoose.Schema(
  {
    username: { type: String, trim: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    success: { type: Boolean, required: true, index: true },
    // ok | mfa_required | mfa_ok | wrong_password | no_user | inactive | locked | ip_limited | mfa_failed
    reason: { type: String },
    ip: { type: String },
    userAgent: { type: String }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

loginLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

module.exports = mongoose.model("LoginLog", loginLogSchema);
