const mongoose = require("mongoose");

// ตาราง Mapping ตัวย่องบในเลขครุภัณฑ์ -> ชื่องบ (Admin เพิ่มได้ตอน Import)
// active=false คืองบในอดีตที่ไม่ใช้แล้ว (เช่น งบคลัง) แต่ยังต้องแสดงในรายงาน
const budgetSchema = new mongoose.Schema(
  {
    abbr: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Budget", budgetSchema);
