const mongoose = require("mongoose");
const { STATUS_KEYS } = require("../constants/status");
const { parseAssetCode } = require("../utils/assetCode");

const assetSchema = new mongoose.Schema(
  {
    // ไม่ unique — เลขครุภัณฑ์ซ้ำกันได้จริง ใช้ _id เป็นตัวระบุชิ้น (และเป็นค่าใน QR Code)
    assetCode: { type: String, required: true, trim: true, index: true },

    // แยกจาก assetCode อัตโนมัติ (ดู pre-validate ด้านล่าง) — null ถ้ารูปแบบเลขไม่ตรง
    codeParts: {
      prefix: String,
      faculty: String,
      budgetAbbr: String,
      year: Number,
      seq: Number,
      total: Number
    },

    // ชื่องบ เช่น "งบพิเศษ" — ได้จากตาราง budgets ตามตัวย่อในเลขครุภัณฑ์
    // ข้อมูลเก่าเก็บชื่องบเดิมไว้ตามจริง ไม่แปลงเป็นงบใหม่
    budget: { type: String, trim: true, default: "ไม่ระบุ", index: true },

    name: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
    brand: { type: String, trim: true },
    category: { type: String, trim: true },

    location: {
      building: { type: String, trim: true },
      floor: { type: String, trim: true },
      room: { type: String, trim: true },
      // ข้อความเต็มที่ใช้แสดงผล/กรอง เช่น "บร.2 ชั้น 1 ห้อง 107"
      label: { type: String, trim: true, index: true }
    },

    // ผู้ถือครอง — อาจารย์/ผู้บริหารไม่มีบัญชีในระบบ จึงเก็บชื่อเป็นข้อความเสมอ
    holderName: { type: String, trim: true },
    // ถ้าผู้ถือครองมีบัญชี ผูกไว้เพื่อให้ login มาตรวจของตัวเองได้ (Sprint ตรวจนับ)
    holderUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    price: { type: Number, min: 0 },
    acquiredAt: { type: Date },

    status: { type: String, enum: STATUS_KEYS, default: "ok", index: true },
    lastInspectedAt: { type: Date },
    // พิมพ์สติกเกอร์ QR แล้วเมื่อไหร่ (ว่าง = ยังไม่เคยพิมพ์ -> ใช้กรองพิมพ์เฉพาะชิ้นใหม่)
    qrPrintedAt: { type: Date },

    // ค่าดิบจาก Excel ทั้งแถว — "ข้อมูลเก่าอย่าลบทิ้ง"
    legacy: { type: mongoose.Schema.Types.Mixed },

    isDeleted: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

assetSchema.pre("validate", function () {
  if (this.isModified("assetCode") || this.isNew) {
    this.codeParts = parseAssetCode(this.assetCode) || undefined;
  }
  const loc = this.location || {};
  if (!loc.label && (loc.building || loc.room)) {
    this.location.label = [loc.building, loc.floor && `ชั้น ${loc.floor}`, loc.room && `ห้อง ${loc.room}`]
      .filter(Boolean)
      .join(" ");
  }
});

module.exports = mongoose.model("Asset", assetSchema);
