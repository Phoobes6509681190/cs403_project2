const test = require("node:test");
const assert = require("node:assert");
const { isCommittee, canViewAll, canInspectItem } = require("../src/services/inspection.service");

const round = { status: "open", committee: ["c1", "c2"] };
const admin = { userId: "a1", role: "admin" };
const member = { userId: "c1", role: "user" };
const holder = { userId: "h1", role: "user" };
const other = { userId: "x1", role: "user" };
const item = { holderUser: "h1" };

test("Admin ดูได้ทั้งหมดแต่ตรวจไม่ได้ ถ้าไม่ได้ถูกแต่งตั้ง (คนซื้อกับคนตรวจต้องเป็นคนละคน)", () => {
  assert.strictEqual(canViewAll(round, admin), true);
  assert.strictEqual(isCommittee(round, admin), false);
  assert.strictEqual(canInspectItem(round, item, admin), false);
  assert.strictEqual(canInspectItem({ ...round, committee: ["a1"] }, item, admin), true);
});

test("กรรมการตรวจได้ทุกชิ้น, ผู้ถือครองตรวจได้เฉพาะของตัวเอง, คนอื่นไม่ได้", () => {
  assert.strictEqual(canInspectItem(round, item, member), true);
  assert.strictEqual(canInspectItem(round, item, holder), true);
  assert.strictEqual(canInspectItem(round, { holderUser: "zz" }, holder), false);
  assert.strictEqual(canInspectItem(round, item, other), false);
  assert.strictEqual(canViewAll(round, holder), false);
});

test("รอบที่ปิดแล้วตรวจไม่ได้", () => {
  assert.strictEqual(canInspectItem({ ...round, status: "closed" }, item, member), false);
});
