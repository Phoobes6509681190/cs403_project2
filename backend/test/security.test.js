const test = require("node:test");
const assert = require("node:assert");
const { authenticator } = require("otplib");
const sec = require("../src/services/security.service");

test("TOTP: รหัสจากแอปถูกต้อง / ผิด / ไม่มี secret", () => {
  const s = sec.newSecret();
  assert.ok(sec.verifyTotp(authenticator.generate(s), s));
  assert.ok(sec.verifyTotp(authenticator.generate(s).replace(/(\d{3})/, "$1 "), s), "มีช่องว่างก็ได้");
  assert.ok(!sec.verifyTotp("000000", s) || authenticator.generate(s) === "000000");
  assert.ok(!sec.verifyTotp("123456", undefined));
  assert.match(sec.otpauthUrl("pae", s), /^otpauth:\/\/totp\/AIMSlog/);
});

test("รหัสสำรอง: 8 ชุด ใช้ได้ครั้งเดียว ไม่สนตัวพิมพ์/ขีด", () => {
  const { plain, hashed } = sec.newBackupCodes();
  assert.strictEqual(plain.length, 8);
  assert.ok(hashed.every((h) => /^[0-9a-f]{64}$/.test(h)));
  const user = { mfaBackupCodes: [...hashed] };
  const code = plain[3];
  assert.ok(sec.consumeBackupCode(user, code.toLowerCase().replace("-", "")));
  assert.strictEqual(user.mfaBackupCodes.length, 7);
  assert.ok(!sec.consumeBackupCode(user, code), "ใช้ซ้ำไม่ได้");
});

test("ล็อกบัญชี: ผิดครบ 5 ครั้งล็อก 15 นาที", async () => {
  const user = { failedLogins: 0, save: async () => {} };
  for (let i = 0; i < 4; i++) await sec.registerFailure(user);
  assert.ok(!sec.isLocked(user));
  await sec.registerFailure(user);
  assert.ok(sec.isLocked(user));
  assert.ok(sec.minutesLeft(user) <= 15 && sec.minutesLeft(user) >= 14);
  await sec.registerSuccess(user);
  assert.ok(!sec.isLocked(user));
});

test("จำกัดต่อ IP: ผิด 20 ครั้งใน 15 นาทีถูกบล็อก", () => {
  const ip = "203.0.113.9";
  for (let i = 0; i < 19; i++) sec.ipFailed(ip);
  assert.ok(!sec.ipBlocked(ip));
  sec.ipFailed(ip);
  assert.ok(sec.ipBlocked(ip));
  sec.ipReset(ip);
  assert.ok(!sec.ipBlocked(ip));
});
