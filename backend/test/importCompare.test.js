const test = require("node:test");
const assert = require("node:assert");
const { classify } = require("../src/services/importCompare");

const row = (n, code, name, extra = {}) => ({
  row: n, errors: [], statusKey: "statusKey" in extra ? extra.statusKey : "ok", statusLabel: extra.statusLabel ?? "ปกติ",
  data: { assetCode: code, name, brand: extra.brand, holderName: extra.holderName, location: extra.location || { label: "บร.2 ชั้น 1 ห้อง 107" } }
});
const asset = (id, code, name, extra = {}) => ({
  _id: id, assetCode: code, name, status: extra.status || "ok",
  location: { label: extra.room || "บร.2 ชั้น 1 ห้อง 107" }, holderName: extra.holderName, brand: extra.brand
});
const resolve = (r) => r.statusKey;

test("แยก ใหม่ / ตรงกัน / ต่างกัน / ซ้ำในไฟล์ / ไม่ครบ / หายจากไฟล์", () => {
  const assets = [
    asset("a1", "วทท-8พ-57-1/80", "คอม"),
    asset("a2", "วทท-8พ-57-2/80", "คอม", { room: "บร.2 ชั้น 1 ห้อง 110", status: "broken" }),
    asset("a3", "วทท-8พ-57-3/80", "คอม"),
    asset("a4", "วทท-8พ-57-4/80", "คอม", { status: "transferred" })
  ];
  const rows = [
    row(3, "วทท-8พ-57-1/80", "คอม"),
    row(4, "วทท-8พ-57-2/80", "คอม"),
    row(5, "วทท-8พ-57-9/80", "คอม"),
    row(6, "วทท-8พ-57-9/80", "คอม"),
    { ...row(7, "", "x"), errors: ["ไม่มีเลขครุภัณฑ์"] }
  ];
  const c = classify(rows, assets, resolve);
  assert.deepStrictEqual(c.same.map((x) => x.row.row), [3]);
  assert.deepStrictEqual(c.changed.map((x) => x.row.row), [4]);
  assert.deepStrictEqual(c.changed[0].diffs.map((d) => d.field).sort(), ["location", "status"]);
  assert.strictEqual(c.changed[0].diffs.find((d) => d.field === "status").currentLabel, "ชำรุด");
  assert.deepStrictEqual(c.fresh.map((r) => r.row), [5]);
  assert.deepStrictEqual(c.dupInFile.map((r) => r.row), [6]);
  assert.deepStrictEqual(c.invalid.map((r) => r.row), [7]);
  // a3 หายจากไฟล์, a4 ตัดโอนแล้วไม่นับ
  assert.deepStrictEqual(c.missing.map((a) => a._id), ["a3"]);
});

test("ช่องว่างในไฟล์ไม่นับว่าต่าง, ช่องว่างเว้นวรรคต่างกันถือว่าเท่ากัน", () => {
  const assets = [asset("a1", "X-1", "คอม", { holderName: "อ.สมชาย", brand: "DELL" })];
  const rows = [row(2, "X-1", "คอม", { location: { label: "บร.2  ชั้น 1 ห้อง 107 " } })];
  const c = classify(rows, assets, resolve);
  assert.strictEqual(c.same.length, 1);
});

test("สถานะที่ยังไม่รู้จัก (รอ Admin เลือก) ไม่ถูกนำไปเทียบ", () => {
  const assets = [asset("a1", "X-1", "คอม", { status: "broken" })];
  const rows = [row(2, "X-1", "คอม", { statusKey: null, statusLabel: "เสียบางส่วน" })];
  const c = classify(rows, assets, resolve);
  assert.strictEqual(c.same.length, 1);
});

test("สถานที่จาก อาคาร/ชั้น/ห้อง เมื่อไม่มีช่องระบุสถานที่", () => {
  const assets = [asset("a1", "X-1", "คอม", { room: "บร.2 ชั้น 1 ห้อง 107" })];
  const rows = [row(2, "X-1", "คอม", { location: { building: "บร.2", floor: "1", room: "107" } })];
  // ช่องระบุสถานที่ตรงกัน — ต่างเฉพาะช่องย่อยที่ในระบบยังว่าง (จะถูกเติมจากไฟล์)
  const c = classify(rows, assets, resolve);
  assert.deepStrictEqual(c.changed[0].diffs.map((d) => d.field), ["building", "floor", "room"]);
});

test("แก้แค่ช่องห้อง (ช่องระบุสถานที่ยังเหมือนเดิม) ต้องเห็นว่าต่าง", () => {
  const assets = [{ _id: "a1", assetCode: "X-1", name: "คอม", status: "ok",
    location: { building: "บร.2", floor: "1", room: "110", label: "บร.2 ชั้น 1 ห้อง 107" } }];
  const rows = [row(2, "X-1", "คอม", { location: { building: "บร.2", floor: "1", room: "107", label: "บร.2 ชั้น 1 ห้อง 107" } })];
  const c = classify(rows, assets, resolve);
  assert.strictEqual(c.changed.length, 1);
  assert.deepStrictEqual(c.changed[0].diffs.map((d) => d.field), ["room"]);
  assert.strictEqual(c.changed[0].diffs[0].currentLabel, "110");
});
