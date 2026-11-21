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

test("parseWorkbook: ไฟล์คณะปี 68 — ข้ามชีตสรุป, เลขอยู่ใน Ref No. 1, ประเภท (FSN), หมายเหตุ F/G", () => {
  const H = ["ตึก/อาคาร", "ชั้น", "ห้อง", "ระบุ สถานที่ใช้งาน", "สภาพ", "ระบุ สภาพครุภัณฑ์เฉพาะที่ใช้งานไม่ได้", "ระบุ สภาพครุภัณฑ์เฉพาะที่สูญหาย",
    "ผู้รับผิดชอบ", "รหัสสินทรัพย์อ้างอิง", "ชื่อสินทรัพย์", "ยี่ห้อ", "รุ่น", "Ref No. 1", "ประเภท (FSN)", "มูลค่าต้นทุนที่ได้มา"];
  const rows = [
    ["บร.2", "2", "211", "บร.2 ชั้น 2 ห้อง 211", "ปกติ", "-", "-", "สาขาวิชาฯ", "", "ชุดโต๊ะ", "EARNEST", "-", "วทท-8พ(4.7)-42-1/7", "10 - เครื่องตกแต่งสำนักงาน", "5,599.99"],
    ["บร.2", "3", "308", "บร.2 ชั้น 3 ห้อง 308", "หาไม่พบ", "-", "หายปี 66", "IT", "", "เก้าอี้", "ITOKI", "GD-01", "วทท-8พ-59-1/15", "10 - เครื่องตกแต่งสำนักงาน", "1,091.40"]
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["สรุป"], ["งบ", "จำนวน"]]), "SUMMARY");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([H, ...rows]), "สินทรัพย์ต่ำกว่า 10000 บาท");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const r = parseWorkbook(buf);
  assert.strictEqual(r.sheet, "สินทรัพย์ต่ำกว่า 10000 บาท");
  assert.deepStrictEqual(r.sheets, ["SUMMARY", "สินทรัพย์ต่ำกว่า 10000 บาท"]);
  assert.strictEqual(r.mapping.assetCode, "Ref No. 1", "คอลัมน์ที่มีข้อมูลชนะคอลัมน์ว่าง");
  const [a, b] = r.rows;
  assert.deepStrictEqual(a.errors, []);
  assert.strictEqual(a.budgetAbbr, "พ");
  assert.strictEqual(a.data.category, "10 - เครื่องตกแต่งสำนักงาน");
  assert.strictEqual(a.data.price, 5599.99);
  assert.strictEqual(a.data.model, undefined, '"-" ถือว่าว่าง');
  assert.strictEqual(b.statusKey, "missing");
  assert.strictEqual(b.data.note, "หายปี 66");
  assert.strictEqual(b.data.holderName, "IT");

  // ผู้ใช้เลือกเอง: ไม่มีคอลัมน์ผู้ถือครอง, ระบุชีตตรง ๆ
  const m = parseWorkbook(buf, { sheet: "สินทรัพย์ต่ำกว่า 10000 บาท", mapping: { holderName: "" } });
  assert.strictEqual(m.rows[0].data.holderName, undefined);
  assert.throws(() => parseWorkbook(buf, { sheet: "SUMMARY" }), /ไม่พบหัวตาราง/);
});

test("parseWorkbook: หลายชีต — รวมทุกชีตที่มีหัวตาราง, แถวซ้ำข้ามชีตนับเป็นซ้ำ, งบจากแหล่งเงิน, สภาพปี 68", () => {
  const { classify } = require("../src/services/importCompare");
  const H = ["Ref No. 1", "ชื่อสินทรัพย์", "สภาพ", "แหล่งเงิน"];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["สรุป"]]), "SUMMARY");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([H, ["วทท-8พ-59-1/2", "เก้าอี้", "เสื่อมสภาพ", "30 - งบ มธ."], ["วทท-8พ-59-2/2", "เก้าอี้", "จำหน่ายแล้ว", "30 - งบ มธ."]]), "ต่ำกว่า 10000");
  // ชีตงบพิเศษเป็นมุมมองซ้อน: แถวแรกซ้ำกับชีตก่อน, แถวสองเป็นของใหม่
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([H, ["วทท-8พ-59-1/2", "เก้าอี้", "เสื่อมสภาพ", "30 - งบ มธ."], ["วทท-8พ-60-1/1", "โต๊ะ", "ข้อมูลซ้ำ", ""]]), "งบพิเศษ");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const r = parseWorkbook(buf);
  assert.deepStrictEqual(r.selectedSheets, ["ต่ำกว่า 10000", "งบพิเศษ"]);
  assert.strictEqual(r.rows.length, 4);
  assert.strictEqual(new Set(r.rows.map((x) => x.ref)).size, 4, "ref ไม่ซ้ำข้ามชีต");
  assert.strictEqual(r.rows[0].statusKey, "unneeded", "เสื่อมสภาพ = หมดความจำเป็น");
  assert.strictEqual(r.rows[1].statusKey, "transferred", "จำหน่ายแล้ว = ตัดโอน");
  assert.strictEqual(r.rows[3].statusKey, "duplicate", "ข้อมูลซ้ำ เก็บตามไฟล์");
  assert.strictEqual(r.rows[0].data.budget, "งบ มธ.");
  assert.strictEqual(r.rows[3].data.budget, undefined, "ไม่มีแหล่งเงิน -> ไปใช้ตัวย่อในเลขแทน");

  const c = classify(r.rows, [], (x) => x.statusKey);
  assert.strictEqual(c.fresh.length, 3);
  assert.strictEqual(c.dupInFile.length, 1);
  assert.strictEqual(c.dupInFile[0].sheet, "งบพิเศษ");

  const only = parseWorkbook(buf, { sheets: ["งบพิเศษ"] });
  assert.deepStrictEqual(only.selectedSheets, ["งบพิเศษ"]);
});
