// Integration test: รัน API จริงกับ MongoDB ชั่วคราว (mongodb-memory-server)
// - สร้างฐานข้อมูลใหม่ทุกครั้ง แล้วลบทิ้งตอนจบ — ไม่แตะข้อมูลใน Atlas
// - ครั้งแรกจะดาวน์โหลดตัว MongoDB (~100–500 MB) แล้วเก็บ cache ไว้ใช้ครั้งต่อไป
// - ถ้าเครื่องไหนดาวน์โหลด/เปิด MongoDB ไม่ได้ ชุดทดสอบนี้จะถูกข้าม (ไม่นับว่า fail)
// รัน: npm test   หรือเฉพาะชุดนี้: npm run test:integration
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

process.env.JWT_SECRET = "integration-test-secret";

const SAMPLE = fs.readFileSync(path.join(__dirname, "../samples/sample-import.xlsx"));
const PASS = "Passw0rd!";

// ---------- helpers ----------
let base;
async function api(method, url, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${base}${url}`, { method, headers, body: payload });
  const type = res.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, headers: res.headers };
}

async function login(username, password = PASS) {
  const res = await api("POST", "/auth/login", { body: { username, password } });
  const cookie = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith("token="));
  return { ...res, token: cookie ? cookie.split(";")[0].slice("token=".length) : null };
}

const fileForm = (buf, name = "sample.xlsx", fields = {}) => {
  const fd = new FormData();
  fd.append("file", new Blob([buf]), name);
  for (const [k, v] of Object.entries(fields)) fd.append(k, typeof v === "string" ? v : JSON.stringify(v));
  return fd;
};

function makeXlsx(aoa) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "S");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

// ---------- the suite ----------
test("integration: API + MongoDB", { timeout: 10 * 60 * 1000 }, async (t) => {
  let mongod, server;
  try {
    const { MongoMemoryServer } = require("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
  } catch (e) {
    t.skip(`ข้าม: เปิด MongoDB ชั่วคราวไม่ได้ (${e.message.split("\n")[0]})`);
    return;
  }

  const User = require("../src/models/User");
  const { ensureDefaultBudgets } = require("../src/services/budget.service");
  const app = require("../src/app");

  await mongoose.connect(mongod.getUri("aimslog-test"));
  await ensureDefaultBudgets();
  const hash = await bcrypt.hash(PASS, 10);
  await User.create([
    { username: "admin", name: "เจ้าหน้าที่พัสดุ", role: "admin", password: hash },
    { username: "member", name: "กรรมการ ก", role: "user", password: hash },
    { username: "holder", name: "อ.ผู้ถือครอง", role: "user", password: hash },
    { username: "other", name: "บุคลากรอื่น", role: "user", password: hash }
  ]);

  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;

  t.after(async () => {
    server?.close();
    await mongoose.disconnect();
    await mongod?.stop();
  });

  const tok = {};
  const ids = {};

  await t.test("health: ต่อฐานข้อมูลแล้ว", async () => {
    const r = await api("GET", "/health");
    assert.strictEqual(r.data.database, "connected");
  });

  await t.test("login: ได้ JWT, รหัสผิดได้ 401", async () => {
    for (const u of ["admin", "member", "holder", "other"]) {
      const r = await login(u);
      assert.strictEqual(r.status, 200, `login ${u}`);
      assert.ok(r.token, `cookie token ของ ${u}`);
      tok[u] = r.token;
      ids[u] = r.data.user.id;
    }
    assert.strictEqual((await login("admin", "wrong")).status, 401);
    const me = await api("GET", "/auth/me", { token: tok.admin });
    assert.strictEqual(me.data.user.role, "admin");
  });

  await t.test("import ครั้งแรก: preview แล้วบันทึก 22 รายการ", async () => {
    const p = await api("POST", "/assets/import/preview", { token: tok.admin, form: fileForm(SAMPLE) });
    assert.strictEqual(p.status, 200);
    assert.strictEqual(p.data.totalRows, 22);
    assert.strictEqual(p.data.newRows, 22);
    assert.strictEqual(p.data.sameRows, 0);
    assert.deepStrictEqual(p.data.unknownBudgets, []);

    const c = await api("POST", "/assets/import", { token: tok.admin, form: fileForm(SAMPLE) });
    assert.strictEqual(c.status, 200);
    assert.strictEqual(c.data.successCount, 22);
    assert.strictEqual(c.data.failedRows.length, 0);
  });

  await t.test("รายการ: ค้นหาบางส่วน / กรองสถานะ / งบอ่านจากเลข / เก็บค่าดิบ", async () => {
    const all = await api("GET", "/assets?perPage=100", { token: tok.admin });
    assert.strictEqual(all.data.total, 22);
    assert.ok(all.data.items.every((a) => a.budget === "งบพิเศษ"));

    const tr = await api("GET", "/assets?status=transferred", { token: tok.admin });
    assert.strictEqual(tr.data.total, 16);

    const q = await api("GET", `/assets?q=${encodeURIComponent("57-13/")}`, { token: tok.admin });
    assert.strictEqual(q.data.total, 1);
    ids.asset13 = q.data.items[0].id;
    assert.strictEqual(q.data.items[0].location.room, "107");

    const Asset = require("../src/models/Asset");
    const raw = await Asset.findById(ids.asset13).lean();
    assert.strictEqual(raw.legacy["สภาพ"], "ปกติ", "เก็บค่าดิบจาก Excel ใน legacy");
  });

  await t.test("user ทั่วไปแก้ไข/นำเข้าไม่ได้ (403)", async () => {
    const r = await api("PUT", `/assets/${ids.asset13}`, { token: tok.other, body: { status: "broken" } });
    assert.strictEqual(r.status, 403);
    const i = await api("POST", "/assets/import/preview", { token: tok.other, form: fileForm(SAMPLE) });
    assert.strictEqual(i.status, 403);
  });

  await t.test("import ซ้ำไฟล์เดิม: ตรงกันทั้งหมด", async () => {
    const p = await api("POST", "/assets/import/preview", { token: tok.admin, form: fileForm(SAMPLE) });
    assert.strictEqual(p.data.newRows, 0);
    assert.strictEqual(p.data.sameRows, 22);
    assert.strictEqual(p.data.changedTotal, 0);
  });

  await t.test("แก้เฉพาะช่องห้อง → import เห็นว่าต่าง และอัปเดตกลับตามไฟล์ + เก็บประวัติ", async () => {
    const u = await api("PUT", `/assets/${ids.asset13}`, {
      token: tok.admin,
      body: { location: { building: "บร.2", floor: "1", room: "110", label: "" } }
    });
    assert.strictEqual(u.status, 200);
    assert.strictEqual(u.data.room, "บร.2 ชั้น 1 ห้อง 110", "ประกอบช่องระบุสถานที่ให้ใหม่");

    const p = await api("POST", "/assets/import/preview", { token: tok.admin, form: fileForm(SAMPLE) });
    assert.strictEqual(p.data.changedTotal, 1);
    const row = p.data.rows.find((r) => r.kind === "changed");
    assert.strictEqual(row.was.room, "110");

    const c = await api("POST", "/assets/import", { token: tok.admin, form: fileForm(SAMPLE) });
    assert.strictEqual(c.data.updatedCount, 1);

    const a = await api("GET", `/assets/${ids.asset13}`, { token: tok.admin });
    assert.strictEqual(a.data.location.room, "107");

    const h = await api("GET", `/assets/${ids.asset13}/history`, { token: tok.admin });
    assert.ok(h.data.items.some((x) => x.action === "import" && x.summary.includes("อัปเดตจาก Excel")));
    assert.ok(h.data.items.some((x) => x.action === "update"), "การแก้ด้วยมือก็มีประวัติ");
  });

  await t.test("งบที่ไม่รู้จัก: แจ้งตอน preview และจำชื่องบหลังบันทึก (ไม่แปลงเป็นงบใหม่)", async () => {
    const buf = makeXlsx([
      ["รหัสสินทรัพย์อ้างอิง", "ชื่อสินทรัพย์", "สภาพ"],
      ["วทท-8ค-50-1/2", "โต๊ะทำงาน", "ปกติ"],
      ["วทท-8ค-50-2/2", "โต๊ะทำงาน", "เสียบางส่วน"]
    ]);
    const p = await api("POST", "/assets/import/preview", { token: tok.admin, form: fileForm(buf) });
    assert.deepStrictEqual(p.data.unknownBudgets.map((b) => b.abbr), ["ค"]);
    assert.deepStrictEqual(p.data.unknownStatuses.map((s) => s.label), ["เสียบางส่วน"]);

    const c = await api("POST", "/assets/import", {
      token: tok.admin,
      form: fileForm(buf, "old.xlsx", { budgetMapping: { ค: "งบคลัง" }, statusMapping: { เสียบางส่วน: "broken" } })
    });
    assert.strictEqual(c.data.successCount, 2);

    const list = await api("GET", `/assets?budget=${encodeURIComponent("งบคลัง")}`, { token: tok.admin });
    assert.strictEqual(list.data.total, 2);
    const b = await api("GET", "/budgets", { token: tok.admin });
    const kh = b.data.items.find((x) => x.abbr === "ค");
    assert.strictEqual(kh.name, "งบคลัง");
    assert.strictEqual(kh.active, false, "งบที่เพิ่มตอน import เป็นงบเดิม");
  });

  await t.test("ผูกบัญชีผู้ถือครองก่อนเปิดรอบ", async () => {
    const q = await api("GET", `/assets?q=${encodeURIComponent("56-3/3")}`, { token: tok.admin });
    ids.held = q.data.items[0].id;
    const r = await api("PUT", `/assets/${ids.held}`, { token: tok.admin, body: { owner: "อ.ผู้ถือครอง", holderUser: ids.holder } });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.holderUser, ids.holder);
  });

  await t.test("ตรวจนับ: เปิดรอบ (ไม่รวมตัดโอน), เปิดซ้ำได้ 409", async () => {
    const r = await api("POST", "/inspections", { token: tok.admin, body: { budgetYear: 2569, committee: [{ userId: ids.member }] } });
    assert.strictEqual(r.status, 201);
    ids.round = r.data.id;
    const again = await api("POST", "/inspections", { token: tok.admin, body: { budgetYear: 2569, committee: [{ userId: ids.member }] } });
    assert.strictEqual(again.status, 409);

    const prog = await api("GET", `/inspections/${ids.round}/progress`, { token: tok.admin });
    assert.strictEqual(prog.data.total, 22 - 16 + 2, "6 ชิ้นปกติจากไฟล์แรก + 2 ชิ้นงบคลัง");
    assert.strictEqual(prog.data.checked, 0);
  });

  await t.test("สิทธิ์ตรวจ: Admin ที่ไม่ได้เป็นกรรมการ/คนอื่นได้ 403, ผู้ถือครองเห็นเฉพาะของตัวเอง", async () => {
    const adm = await api("POST", `/inspections/${ids.round}/items`, { token: tok.admin, body: { assetId: ids.asset13, status: "ok" } });
    assert.strictEqual(adm.status, 403);
    const oth = await api("POST", `/inspections/${ids.round}/items`, { token: tok.other, body: { assetId: ids.asset13, status: "ok" } });
    assert.strictEqual(oth.status, 403);

    const mine = await api("GET", `/inspections/${ids.round}`, { token: tok.holder });
    assert.strictEqual(mine.data.scope, "mine");
    assert.deepStrictEqual(mine.data.items.map((i) => i.assetId), [ids.held]);

    const self = await api("POST", `/inspections/${ids.round}/items`, { token: tok.holder, body: { assetId: ids.held, status: "ok" } });
    assert.strictEqual(self.status, 200);
    assert.strictEqual(self.data.item.method, "self");
  });

  await t.test("กรรมการบันทึกผล: สถานะครุภัณฑ์เปลี่ยน + ประวัติ, ตัดโอนไม่ใช่ผลตรวจ", async () => {
    const r = await api("POST", `/inspections/${ids.round}/items`, { token: tok.member, body: { assetId: ids.asset13, status: "broken", note: "จอแตก" } });
    assert.strictEqual(r.status, 200);
    const a = await api("GET", `/assets/${ids.asset13}`, { token: tok.admin });
    assert.strictEqual(a.data.status, "broken");
    assert.ok(a.data.lastInspectedAt);

    const bad = await api("POST", `/inspections/${ids.round}/items`, { token: tok.member, body: { assetId: ids.asset13, status: "transferred" } });
    assert.strictEqual(bad.status, 400);
  });

  await t.test("ตรวจทั้งห้อง: บันทึกเฉพาะชิ้นที่ยังไม่ตรวจ ไม่ทับผลเดิม", async () => {
    const r = await api("POST", `/inspections/${ids.round}/bulk`, {
      token: tok.member, body: { room: "บร.2 ชั้น 1 ห้อง 107", status: "missing" }
    });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.updated, 4, "6 ชิ้นในห้อง 107 - ที่ตรวจแล้ว 2 ชิ้น");

    const a = await api("GET", `/assets/${ids.asset13}`, { token: tok.admin });
    assert.strictEqual(a.data.status, "broken", "ชิ้นที่ตรวจแล้วไม่ถูกทับ");

    const prog = await api("GET", `/inspections/${ids.round}/progress`, { token: tok.admin });
    assert.strictEqual(prog.data.checked, 6);
    assert.strictEqual(prog.data.selfChecked, 1);
    assert.strictEqual(prog.data.byResult.missing, 4);
  });

  await t.test("ปิดรอบ: บันทึกผลต่อไม่ได้ (409)", async () => {
    const c = await api("PUT", `/inspections/${ids.round}/close`, { token: tok.admin });
    assert.strictEqual(c.status, 200);
    const after = await api("POST", `/inspections/${ids.round}/items`, { token: tok.member, body: { assetId: ids.asset13, status: "ok" } });
    assert.strictEqual(after.status, 409);
  });

  await t.test("รายงาน: ยอดรวมไม่นับตัดโอน, งบเดิมแยกแถว, ชำรุดแยกซ่อมได้", async () => {
    const s = await api("GET", "/reports/summary", { token: tok.admin });
    assert.strictEqual(s.status, 200);
    assert.strictEqual(s.data.transferred, 16);
    assert.strictEqual(s.data.total, 8);
    assert.strictEqual(s.data.byStatus.broken, 2, "57-13 จากการตรวจ + 1 ชิ้นงบคลัง");
    assert.strictEqual(s.data.byStatus.missing, 4);
    const kh = s.data.groups.find((g) => g.budget === "งบคลัง");
    assert.strictEqual(kh.active, false);
    assert.strictEqual(kh.total, 2);
    assert.strictEqual(s.data.inspection.status, "closed");

    const d = await api("GET", "/reports/detail", { token: tok.admin });
    assert.strictEqual(d.data.items.length, 24);
    assert.strictEqual(d.data.inspectionYear, 2569);
  });

  await t.test("ถังขยะ: ลบ → กู้คืน → ลบ → ลบถาวร", async () => {
    const del = await api("DELETE", `/assets/${ids.held}`, { token: tok.admin });
    assert.strictEqual(del.status, 200);
    assert.strictEqual((await api("GET", `/assets/${ids.held}`, { token: tok.admin })).status, 404);

    const trash = await api("GET", "/assets/trash", { token: tok.admin });
    assert.deepStrictEqual(trash.data.items.map((a) => a.id), [ids.held]);

    // ลบถาวรได้เฉพาะของในถังขยะ
    assert.strictEqual((await api("DELETE", `/assets/${ids.asset13}/permanent`, { token: tok.admin })).status, 404);

    assert.strictEqual((await api("POST", `/assets/${ids.held}/restore`, { token: tok.admin })).status, 200);
    assert.strictEqual((await api("GET", `/assets/${ids.held}`, { token: tok.admin })).status, 200);

    await api("DELETE", `/assets/${ids.held}`, { token: tok.admin });
    const purge = await api("DELETE", `/assets/${ids.held}/permanent`, { token: tok.admin });
    assert.strictEqual(purge.data.deleted, 1);
    assert.strictEqual((await api("GET", "/assets/trash", { token: tok.admin })).data.items.length, 0);

    // รายงานปีที่ปิดแล้วยังมีผลตรวจของชิ้นที่ลบถาวร (เก็บสำเนาใน InspectionItem)
    const InspectionItem = require("../src/models/InspectionItem");
    assert.ok(await InspectionItem.exists({ asset: ids.held }));
  });

  await t.test("ผู้ใช้: เพิ่ม, ชื่อซ้ำ 409, ปิดบัญชีแล้ว login ไม่ได้, แก้สิทธิ์ตัวเองไม่ได้", async () => {
    const c = await api("POST", "/users", { token: tok.admin, body: { username: "newbie", name: "ผู้ใช้ใหม่", password: "Newbie123", role: "user" } });
    assert.strictEqual(c.status, 201);
    const dup = await api("POST", "/users", { token: tok.admin, body: { username: "newbie", name: "x", password: "Newbie123" } });
    assert.strictEqual(dup.status, 409);

    assert.strictEqual((await login("newbie", "Newbie123")).status, 200);
    const off = await api("PUT", `/users/${c.data.id}`, { token: tok.admin, body: { active: false } });
    assert.strictEqual(off.data.active, false);
    assert.strictEqual((await login("newbie", "Newbie123")).status, 401);

    const self = await api("PUT", `/users/${ids.admin}`, { token: tok.admin, body: { role: "user" } });
    assert.strictEqual(self.status, 400);
  });

  await t.test("รหัสชั่วคราวจาก Admin: ต้องเปลี่ยนรหัสก่อนใช้งาน แล้วได้ session ใหม่", async () => {
    const c = await api("POST", "/users", { token: tok.admin, body: { username: "temp1", name: "ผู้ใช้รหัสชั่วคราว", password: "Temp12345", role: "user" } });
    assert.strictEqual(c.status, 201);

    const l = await login("temp1", "Temp12345");
    assert.strictEqual(l.status, 200);
    assert.strictEqual(l.data.user.mustChangePassword, true);
    const blocked = await api("GET", "/assets", { token: l.token });
    assert.strictEqual(blocked.status, 403);
    assert.strictEqual(blocked.data.code, "PASSWORD_CHANGE_REQUIRED");

    const ch = await api("PUT", "/auth/password", { token: l.token, body: { currentPassword: "Temp12345", newPassword: "Mine12345" } });
    assert.strictEqual(ch.status, 200);
    assert.strictEqual(ch.data.user.mustChangePassword, false);
    const fresh = (ch.headers.getSetCookie?.() || []).find((x) => x.startsWith("token="));
    assert.ok(fresh, "ได้ token ใหม่หลังเปลี่ยนรหัส");
    const ok = await api("GET", "/assets", { token: fresh.split(";")[0].slice(6) });
    assert.strictEqual(ok.status, 200);

    // Admin ตั้งรหัสใหม่ให้ -> กลับไปต้องเปลี่ยนรหัสอีกครั้ง
    await api("PUT", `/users/${c.data.id}/password`, { token: tok.admin, body: { newPassword: "Again12345" } });
    const l2 = await login("temp1", "Again12345");
    assert.strictEqual(l2.data.user.mustChangePassword, true);
    const User = require("../src/models/User");
    assert.ok((await User.findById(c.data.id)).passwordResetAt);
  });

  await t.test("โปรไฟล์และรหัสผ่าน", async () => {
    const p = await api("PUT", "/auth/profile", { token: tok.member, body: { position: "อาจารย์", email: "ผิดรูปแบบ" } });
    assert.strictEqual(p.status, 400);
    const ok = await api("PUT", "/auth/profile", { token: tok.member, body: { position: "อาจารย์", bio: "ทดสอบ" } });
    assert.strictEqual(ok.data.user.position, "อาจารย์");

    const wrong = await api("PUT", "/auth/password", { token: tok.member, body: { currentPassword: "wrong", newPassword: "NewPass123" } });
    assert.strictEqual(wrong.status, 400);
    const ch = await api("PUT", "/auth/password", { token: tok.member, body: { currentPassword: PASS, newPassword: "NewPass123" } });
    assert.strictEqual(ch.status, 200);
    assert.strictEqual((await login("member", "NewPass123")).status, 200);
  });

  await t.test("ล็อกบัญชี: ผิด 5 ครั้งเข้าไม่ได้แม้รหัสถูก, Admin ปลดล็อกได้, มีประวัติ login", async () => {
    const c = await api("POST", "/users", { token: tok.admin, body: { username: "victim", name: "บัญชีถูกเดา", password: "Victim123", role: "user" } });
    for (let i = 0; i < 4; i++) assert.strictEqual((await login("victim", `guess${i}`)).status, 401);
    assert.strictEqual((await login("victim", "guess5")).status, 429, "ครั้งที่ 5 ล็อก");
    assert.strictEqual((await login("victim", "Victim123")).status, 429, "รหัสถูกก็ยังเข้าไม่ได้ระหว่างล็อก");

    const list = await api("GET", "/users", { token: tok.admin });
    assert.strictEqual(list.data.items.find((u) => u.id === c.data.id).locked, true);
    await api("PUT", `/users/${c.data.id}/unlock`, { token: tok.admin });
    assert.strictEqual((await login("victim", "Victim123")).status, 200);

    const logs = await api("GET", "/login-logs?username=victim", { token: tok.admin });
    const reasons = logs.data.items.map((l) => l.reason);
    assert.ok(reasons.includes("wrong_password"));
    assert.ok(reasons.includes("locked"));
    assert.ok(reasons.includes("ok"));
    assert.ok(logs.data.items.every((l) => l.ip));
    assert.strictEqual((await api("GET", "/login-logs", { token: tok.member })).status, 403);
  });

  await t.test("MFA: ตั้งค่า → login ต้องใส่รหัส 6 หลัก → รหัสสำรองใช้ได้ครั้งเดียว → Admin รีเซ็ตได้", async () => {
    const { authenticator } = require("otplib");
    await api("POST", "/users", { token: tok.admin, body: { username: "mfa1", name: "ใช้ MFA", password: "Mfa123456", role: "admin" } });
    let l = await login("mfa1", "Mfa123456");
    const ch = await api("PUT", "/auth/password", { token: l.token, body: { currentPassword: "Mfa123456", newPassword: "Mfa654321" } });
    const t1 = (ch.headers.getSetCookie?.() || []).find((x) => x.startsWith("token=")).split(";")[0].slice(6);

    const setup = await api("POST", "/auth/mfa/setup", { token: t1 });
    assert.match(setup.data.otpauthUrl, /^otpauth:\/\/totp\//);
    assert.strictEqual((await api("POST", "/auth/mfa/enable", { token: t1, body: { code: "000000" } })).status === 400 ||
      authenticator.generate(setup.data.secret) === "000000", true);
    const en = await api("POST", "/auth/mfa/enable", { token: t1, body: { code: authenticator.generate(setup.data.secret) } });
    assert.strictEqual(en.status, 200);
    assert.strictEqual(en.data.backupCodes.length, 8);

    // login: รหัสผ่านถูก -> ยังไม่ได้ session ต้องยืนยัน MFA
    l = await login("mfa1", "Mfa654321");
    assert.strictEqual(l.data.mfaRequired, true);
    assert.strictEqual(l.token, null, "ยังไม่ออก cookie session");
    assert.strictEqual((await api("GET", "/assets", { token: l.data.mfaToken })).status, 401, "mfaToken ใช้แทน session ไม่ได้");

    const bad = await api("POST", "/auth/mfa/verify", { body: { mfaToken: l.data.mfaToken, code: "12345" } });
    assert.strictEqual(bad.status, 401);
    const good = await api("POST", "/auth/mfa/verify", { body: { mfaToken: l.data.mfaToken, code: authenticator.generate(setup.data.secret) } });
    assert.strictEqual(good.status, 200);
    assert.ok((good.headers.getSetCookie?.() || []).some((x) => x.startsWith("token=")));

    // รหัสสำรอง
    const backup = en.data.backupCodes[0];
    l = await login("mfa1", "Mfa654321");
    const b1 = await api("POST", "/auth/mfa/verify", { body: { mfaToken: l.data.mfaToken, code: backup } });
    assert.strictEqual(b1.status, 200);
    assert.strictEqual(b1.data.backupCodesLeft, 7);
    l = await login("mfa1", "Mfa654321");
    assert.strictEqual((await api("POST", "/auth/mfa/verify", { body: { mfaToken: l.data.mfaToken, code: backup } })).status, 401, "ใช้ซ้ำไม่ได้");

    // Admin อีกคนรีเซ็ต MFA ให้ (ทำมือถือหาย)
    const users = await api("GET", "/users", { token: tok.admin });
    const mfaUser = users.data.items.find((u) => u.username === "mfa1");
    assert.strictEqual(mfaUser.mfaEnabled, true);
    await api("PUT", `/users/${mfaUser.id}/mfa-reset`, { token: tok.admin });
    l = await login("mfa1", "Mfa654321");
    assert.ok(l.token, "login ได้เลยโดยไม่ต้องใช้ MFA");
  });

  await t.test("สำรองข้อมูล: ได้ไฟล์ Excel ที่มีทุก sheet และไม่มีรหัสผ่าน", async () => {
    const r = await api("GET", "/backup", { token: tok.admin });
    assert.strictEqual(r.status, 200);
    const wb = XLSX.read(Buffer.from(r.data), { type: "buffer" });
    assert.deepStrictEqual(wb.SheetNames, ["ครุภัณฑ์", "ประวัติ", "ผลตรวจนับ", "งบประมาณ", "ผู้ใช้"]);
    const users = XLSX.utils.sheet_to_json(wb.Sheets["ผู้ใช้"]);
    assert.ok(users.length >= 5);
    assert.ok(users.every((u) => !("password" in u)));
  });
});
