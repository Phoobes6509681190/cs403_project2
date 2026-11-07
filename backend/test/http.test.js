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
