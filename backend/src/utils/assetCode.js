// แยกส่วนประกอบของเลขครุภัณฑ์ เช่น "วทท-8พ-57-1/80" หรือ "วทท-8กท-69-1-70"
//   prefix = วทท, faculty = 8, budgetAbbr = พ, year = 57 (พ.ศ. 2 หลัก), seq = 1, total = 80
// เลขครุภัณฑ์ "ซ้ำกันได้" (ปีเดียวกัน งบเดียวกัน จำนวนเท่ากัน) จึงใช้เป็นตัวระบุชิ้นไม่ได้ — ใช้ _id แทน
const CODE_RE = /^\s*([ก-ฮ]+)\s*-\s*(\d+)\s*([ก-ฮ]+)\s*-\s*(\d{2,4})\s*-\s*(\d+)\s*[/-]\s*(\d+)\s*$/;

function parseAssetCode(code) {
  const m = String(code ?? "").match(CODE_RE);
  if (!m) return null;
  return {
    prefix: m[1],
    faculty: m[2],
    budgetAbbr: m[3],
    year: Number(m[4]),
    seq: Number(m[5]),
    total: Number(m[6])
  };
}

module.exports = { parseAssetCode };
