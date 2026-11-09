const Budget = require("../models/Budget");
const { parseAssetCode } = require("../utils/assetCode");

// งบเริ่มต้นตามที่เจ้าหน้าที่พัสดุให้ข้อมูล (ปัจจุบันใช้ 2 งบ)
// งบเก่า (งบคลัง, งบรายได้หน่วยงาน) ยังไม่รู้ตัวย่อ — Admin เลือกให้ตอน Import ครั้งแรกที่เจอ
const DEFAULT_BUDGETS = [
  { abbr: "พ", name: "งบพิเศษ", active: true },
  { abbr: "กท", name: "งบกองทุนค่าธรรมเนียม", active: true }
];

async function ensureDefaultBudgets() {
  for (const b of DEFAULT_BUDGETS) {
    await Budget.updateOne({ abbr: b.abbr }, { $setOnInsert: b }, { upsert: true });
  }
}

async function getBudgetMap() {
  const list = await Budget.find().lean();
  return new Map(list.map((b) => [b.abbr, b.name]));
}

// คืนชื่องบจากเลขครุภัณฑ์ — null ถ้าตัวย่อยังไม่อยู่ในตาราง
function budgetNameFromCode(code, budgetMap) {
  const parts = parseAssetCode(code);
  if (!parts) return null;
  return budgetMap.get(parts.budgetAbbr) || null;
}

module.exports = { ensureDefaultBudgets, getBudgetMap, budgetNameFromCode, DEFAULT_BUDGETS };
