const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },

    password: {
      type: String,
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    // โปรไฟล์ (ตั้งค่าเองได้ในหน้าโปรไฟล์)
    position: { type: String, trim: true, maxlength: 100 },
    email: { type: String, trim: true, maxlength: 120 },
    phone: { type: String, trim: true, maxlength: 30 },
    bio: { type: String, trim: true, maxlength: 300 },
    // รูปโปรไฟล์เป็น data URL ที่ย่อขนาดฝั่งหน้าเว็บแล้ว (ไม่ต้องมีที่เก็บไฟล์แยก)
    avatar: { type: String, maxlength: 200000 },
    // ปิดบัญชีแทนการลบ — ประวัติที่ผู้ใช้คนนี้เคยบันทึกยังอยู่ครบ
    active: { type: Boolean, default: true },

    // ต้องเปลี่ยนรหัสผ่านก่อนใช้งาน — ตั้งเมื่อ Admin สร้างบัญชี/ตั้งรหัสให้ หรือใช้สคริปต์กู้รหัส
    mustChangePassword: { type: Boolean, default: false },
    passwordResetAt: { type: Date },

    // กันเดารหัส: login ผิดติดกัน 5 ครั้ง -> ล็อก 15 นาที
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date },

    // ยืนยัน 2 ขั้นตอน (TOTP — Google Authenticator / Microsoft Authenticator)
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String },
    mfaPendingSecret: { type: String }, // ระหว่างตั้งค่า (ยังไม่ยืนยันรหัส)
    mfaBackupCodes: [{ type: String }], // เก็บแบบ hash ใช้ได้ครั้งเดียว

    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);