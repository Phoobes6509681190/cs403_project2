const test = require("node:test");
const assert = require("node:assert");
const { isCommittee, canViewAll, canInspectItem } = require("../src/services/inspection.service");

const round = { status: "open", committee: ["c1", "c2"] };
const admin = { userId: "a1", role: "admin" };
const member = { userId: "c1", role: "staff" };
const staff = { userId: "s1", role: "staff" };
const holder = { userId: "h1", role: "user" };
const userInCommittee = { userId: "c2", role: "user" };
const item = { holderUser: "h1" };

test("ผู้ดูแลระบบตรวจได้เสมอ (ทำได้ทุกอย่าง) แม้ไม่ได้ถูกแต่งตั้ง", () => {
  assert.strictEqual(canViewAll(round, admin), true);
  assert.strictEqual(isCommittee(round, admin), false);
  assert.strictEqual(canInspectItem(round, item, admin), true);
});

test("เจ้าหน้าที่ตรวจได้เฉพาะเมื่อเป็นกรรมการรอบนี้", () => {
  assert.strictEqual(canInspectItem(round, item, member), true);
  assert.strictEqual(canInspectItem(round, item, staff), false);
  assert.strictEqual(canViewAll(round, staff), true);
});

test("ผู้ใช้ปกติตรวจไม่ได้ ทั้งของที่ถือครองเอง และแม้ชื่ออยู่ในกรรมการ", () => {
  assert.strictEqual(canInspectItem(round, item, holder), false);
  assert.strictEqual(canInspectItem(round, item, userInCommittee), false);
  assert.strictEqual(canViewAll(round, holder), false);
});

test("รอบที่ปิดแล้วตรวจไม่ได้", () => {
  assert.strictEqual(canInspectItem({ ...round, status: "closed" }, item, member), false);
  assert.strictEqual(canInspectItem({ ...round, status: "closed" }, item, admin), false);
});
