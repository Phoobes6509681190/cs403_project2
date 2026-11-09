const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { parseAssetCode } = require("../src/utils/assetCode");
const { statusFromLabel } = require("../src/constants/status");
const { parseWorkbook } = require("../src/services/import.service");
const escapeRegex = require("../src/utils/escapeRegex");

test("parseAssetCode: รองรับทั้ง / และ - และตัวย่องบหลายตัวอักษร", () => {
  assert.deepStrictEqual(parseAssetCode("วทท-8พ-57-1/80"), { prefix: "วทท", faculty: "8", budgetAbbr: "พ", year: 57, seq: 1, total: 80 });
  assert.deepStrictEqual(parseAssetCode("วทท-8พ-69-1-70"), { prefix: "วทท", faculty: "8", budgetAbbr: "พ", year: 69, seq: 1, total: 70 });
  assert.strictEqual(parseAssetCode("วทท-8กท-68-3/10").budgetAbbr, "กท");
  assert.strictEqual(parseAssetCode(" วทท - 8พ - 57 - 1 / 80 ").seq, 1);
  assert.strictEqual(parseAssetCode("ABC-123"), null);
  assert.strictEqual(parseAssetCode(""), null);
});

test("statusFromLabel: แปลงสถานะภาษาไทยและคำที่ใกล้เคียง", () => {
  assert.strictEqual(statusFromLabel("ปกติ"), "ok");
  assert.strictEqual(statusFromLabel(" ตัดโอน "), "transferred");
  assert.strictEqual(statusFromLabel("หมดความจำเป็นในการใช้งาน"), "unneeded");
  assert.strictEqual(statusFromLabel("ไม่พบพัสดุในทะเบียน"), "missing");
  assert.strictEqual(statusFromLabel("รอจำหน่าย"), "disposal");
  assert.strictEqual(statusFromLabel(""), "ok");
  assert.strictEqual(statusFromLabel("broken"), "broken");
  assert.strictEqual(statusFromLabel("อะไรก็ไม่รู้"), null);
});

test("parseWorkbook: อ่านไฟล์ตัวอย่างที่มีหัวกระดาษก่อนหัวตาราง", () => {
  const buf = fs.readFileSync(path.join(__dirname, "../samples/sample-import.xlsx"));
  const r = parseWorkbook(buf);
  assert.strictEqual(r.headerRow, 2);
  assert.strictEqual(r.rows.length, 22);
  const first = r.rows[0];
  assert.strictEqual(first.row, 3);
  assert.strictEqual(first.data.assetCode, "วทท-8พ-57-1/80");
  assert.strictEqual(first.statusKey, "transferred");
  assert.strictEqual(first.budgetAbbr, "พ");
  assert.strictEqual(first.data.location.label, "บร.2 ชั้น 1 ห้อง 107");
  assert.strictEqual(first.data.location.room, "107");
  assert.strictEqual(first.raw["สภาพ"], "ตัดโอน"); // เก็บค่าดิบไว้
  assert.ok(r.rows.every((x) => x.errors.length === 0));
});

test("parseWorkbook: แถวข้อมูลไม่ครบ / สถานะไม่รู้จัก / ไม่มีหัวตาราง", () => {
  const make = (aoa) => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "S");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  };
  const r = parseWorkbook(make([
    ["รหัสครุภัณฑ์", "ชื่อครุภัณฑ์", "สถานะ", "ผู้ถือครอง", "ราคา"],
    ["วทท-8ค-50-1/2", "โต๊ะ", "เสียบางส่วน", "อ.สมชาย", "12,500"],
    ["", "เก้าอี้", "ปกติ", "", ""],
    ["", "", "", "", ""]
  ]));
  assert.strictEqual(r.rows.length, 2); // แถวว่างถูกข้าม
  assert.strictEqual(r.rows[0].statusKey, null);
  assert.strictEqual(r.rows[0].budgetAbbr, "ค");
  assert.strictEqual(r.rows[0].data.holderName, "อ.สมชาย");
  assert.strictEqual(r.rows[0].data.price, 12500);
  assert.deepStrictEqual(r.rows[1].errors, ["ไม่มีเลขครุภัณฑ์"]);
  assert.throws(() => parseWorkbook(make([["a", "b"], ["1", "2"]])), /ไม่พบหัวตาราง/);
});

test("escapeRegex: ข้อความค้นหาไม่กลายเป็น regex", () => {
  assert.ok(new RegExp(escapeRegex("1/80 (DELL)")).test("วทท 1/80 (DELL)"));
  assert.doesNotThrow(() => new RegExp(escapeRegex("((((")));
});
