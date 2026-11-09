// ทดสอบ middleware ระดับ HTTP ที่ไม่ต้องใช้ฐานข้อมูล (auth / csrf / role / 404)
const test = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-secret";
const app = require("../src/app");

let server, base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
test.after(() => server.close());

const tokenFor = (role) => jwt.sign({ userId: "64b000000000000000000001", username: role, name: role, role }, "test-secret");

test("health ตอบได้แม้ยังไม่ต่อ DB", async () => {
  const r = await fetch(`${base}/health`);
  assert.strictEqual(r.status, 200);
  assert.strictEqual((await r.json()).database, "disconnected");
});

test("ไม่มี token -> 401", async () => {
  assert.strictEqual((await fetch(`${base}/assets`)).status, 401);
  assert.strictEqual((await fetch(`${base}/auth/me`)).status, 401);
});

test("token ผิด -> 401", async () => {
  const r = await fetch(`${base}/assets`, { headers: { Authorization: "Bearer xxx" } });
  assert.strictEqual(r.status, 401);
});

test("user ทั่วไปเพิ่มครุภัณฑ์ไม่ได้ -> 403", async () => {
  const r = await fetch(`${base}/assets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenFor("user")}`, "Content-Type": "application/json" },
    body: "{}"
  });
  assert.strictEqual(r.status, 403);
});

test("ใช้ cookie แต่ไม่ส่ง X-CSRF-Token -> 403", async () => {
  const r = await fetch(`${base}/assets`, {
    method: "POST",
    headers: { Cookie: `token=${tokenFor("admin")}; csrfToken=abc`, "Content-Type": "application/json" },
    body: "{}"
  });
  assert.strictEqual(r.status, 403);
  assert.match((await r.json()).message, /CSRF/);
});

test("logout ลบ cookie ได้แม้ไม่ได้ login", async () => {
  const r = await fetch(`${base}/auth/logout`, { method: "POST" });
  assert.strictEqual(r.status, 200);
  assert.match(r.headers.get("set-cookie") || "", /token=;/);
});

test("เส้นทางที่ไม่มี -> 404 JSON", async () => {
  const r = await fetch(`${base}/nope`);
  assert.strictEqual(r.status, 404);
});

test("user ทั่วไปดูรายชื่อผู้ใช้ / เปิดรอบตรวจนับไม่ได้ -> 403", async () => {
  const h = { Authorization: `Bearer ${tokenFor("user")}`, "Content-Type": "application/json" };
  assert.strictEqual((await fetch(`${base}/users`, { headers: h })).status, 403);
  assert.strictEqual((await fetch(`${base}/inspections`, { method: "POST", headers: h, body: "{}" })).status, 403);
  assert.strictEqual((await fetch(`${base}/inspections/x/close`, { method: "PUT", headers: h })).status, 403);
});

test("รายงานต้อง login", async () => {
  assert.strictEqual((await fetch(`${base}/reports/summary`)).status, 401);
  assert.strictEqual((await fetch(`${base}/reports/detail`)).status, 401);
});

test("เปลี่ยนรหัสผ่าน: ต้อง login และ user ทั่วไปรีเซ็ตรหัสคนอื่นไม่ได้", async () => {
  assert.strictEqual((await fetch(`${base}/auth/password`, { method: "PUT" })).status, 401);
  const h = { Authorization: `Bearer ${tokenFor("user")}`, "Content-Type": "application/json" };
  const r = await fetch(`${base}/users/64b000000000000000000002/password`, { method: "PUT", headers: h, body: "{}" });
  assert.strictEqual(r.status, 403);
  const short = await fetch(`${base}/auth/password`, { method: "PUT", headers: h, body: JSON.stringify({ currentPassword: "a", newPassword: "b" }) });
  assert.strictEqual(short.status, 400);
});

test("ถังขยะ / กู้คืน / สำรองข้อมูล / จัดการผู้ใช้ = admin เท่านั้น", async () => {
  const h = { Authorization: `Bearer ${tokenFor("user")}`, "Content-Type": "application/json" };
  assert.strictEqual((await fetch(`${base}/assets/trash`, { headers: h })).status, 403);
  assert.strictEqual((await fetch(`${base}/assets/64b000000000000000000003/restore`, { method: "POST", headers: h })).status, 403);
  assert.strictEqual((await fetch(`${base}/backup`, { headers: h })).status, 403);
  assert.strictEqual((await fetch(`${base}/users/64b000000000000000000003`, { method: "PUT", headers: h, body: "{}" })).status, 403);
  assert.strictEqual((await fetch(`${base}/auth/profile`, { method: "PUT" })).status, 401);
});

test("ลบถาวร / ล้างถังขยะ = admin เท่านั้น", async () => {
  const h = { Authorization: `Bearer ${tokenFor("user")}` };
  assert.strictEqual((await fetch(`${base}/assets/trash`, { method: "DELETE", headers: h })).status, 403);
  assert.strictEqual((await fetch(`${base}/assets/64b000000000000000000003/permanent`, { method: "DELETE", headers: h })).status, 403);
});

test("บัญชีที่ต้องเปลี่ยนรหัส (mcp) เรียก API อื่นไม่ได้ จนกว่าจะเปลี่ยนรหัส", async () => {
  const t = jwt.sign({ userId: "64b000000000000000000001", username: "x", name: "x", role: "admin", mcp: true }, "test-secret");
  const r = await fetch(`${base}/assets`, { headers: { Authorization: `Bearer ${t}` } });
  assert.strictEqual(r.status, 403);
  assert.strictEqual((await r.json()).code, "PASSWORD_CHANGE_REQUIRED");
  const b = await fetch(`${base}/backup`, { headers: { Authorization: `Bearer ${t}` } });
  assert.strictEqual(b.status, 403);
  // /api/auth/* ยังเรียกได้ (เช่น เปลี่ยนรหัส) — ตอบ 400 เพราะไม่ส่งข้อมูล ไม่ใช่ 403
  const p = await fetch(`${base}/auth/password`, { method: "PUT", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }, body: "{}" });
  assert.strictEqual(p.status, 400);
});
