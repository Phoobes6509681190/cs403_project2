const crypto = require("crypto");
const { authenticator } = require("otplib");
const LoginLog = require("../models/LoginLog");

const MAX_FAILED = Number(process.env.LOGIN_MAX_FAILED || 5);
const LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);
// จำกัดต่อ IP ด้วย (กันไล่เดาหลายบัญชีจากเครื่องเดียว): ผิดได้ 20 ครั้ง / 15 นาที
const IP_MAX_FAILED = Number(process.env.LOGIN_IP_MAX_FAILED || 20);
const IP_WINDOW_MS = 15 * 60 * 1000;

authenticator.options = { window: 1 }; // ยอมรับรหัสคลาดเวลา ±30 วินาที

// IP จริงของผู้ใช้ (หน้าเว็บ -> Vercel -> Render จึงอ่านจาก X-Forwarded-For ตัวแรก)
function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || "";
}

// ตัวนับ login ผิดต่อ IP (เก็บในหน่วยความจำ — server รีสตาร์ทแล้วเริ่มนับใหม่ ซึ่งยอมรับได้)
const ipFails = new Map();
function ipBlocked(ip) {
  const e = ipFails.get(ip);
  if (!e) return false;
  if (Date.now() - e.first > IP_WINDOW_MS) {
    ipFails.delete(ip);
    return false;
  }
  return e.count >= IP_MAX_FAILED;
}
function ipFailed(ip) {
  const e = ipFails.get(ip);
  if (!e || Date.now() - e.first > IP_WINDOW_MS) ipFails.set(ip, { count: 1, first: Date.now() });
  else e.count++;
}
const ipReset = (ip) => ipFails.delete(ip);

function isLocked(user) {
  return user?.lockedUntil && user.lockedUntil > new Date();
}

// login ผิด 1 ครั้ง — ครบ MAX_FAILED ล็อกบัญชี
async function registerFailure(user) {
  if (!user) return;
  user.failedLogins = (user.failedLogins || 0) + 1;
  if (user.failedLogins >= MAX_FAILED) {
    user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
    user.failedLogins = 0;
  }
  await user.save();
}

async function registerSuccess(user) {
  if (user.failedLogins || user.lockedUntil) {
    user.failedLogins = 0;
    user.lockedUntil = undefined;
    await user.save();
  }
}

function minutesLeft(user) {
  return Math.max(1, Math.ceil((user.lockedUntil - Date.now()) / 60000));
}

async function logLogin(req, { username, user, success, reason }) {
  try {
    await LoginLog.create({
      username: username ? String(username).slice(0, 100) : undefined,
      user: user?._id,
      success,
      reason,
      ip: clientIp(req),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300)
    });
  } catch {
    /* การบันทึก log ล้มเหลวต้องไม่ทำให้ login ล้มเหลว */
  }
}

// ---------- MFA ----------
const ISSUER = "AIMSlog CS-TU";
const newSecret = () => authenticator.generateSecret();
const otpauthUrl = (username, secret) => authenticator.keyuri(username, ISSUER, secret);
const verifyTotp = (code, secret) => !!secret && authenticator.verify({ token: String(code || "").replace(/\s/g, ""), secret });

// รหัสสำรอง 8 ชุด (ใช้เมื่อทำมือถือหาย) — แสดงครั้งเดียว เก็บแบบ hash
const hashCode = (c) => crypto.createHash("sha256").update(String(c).replace(/[\s-]/g, "").toUpperCase()).digest("hex");
function newBackupCodes(n = 8) {
  const plain = Array.from({ length: n }, () => {
    const s = crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 ตัว
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
  return { plain, hashed: plain.map(hashCode) };
}
// ใช้รหัสสำรอง: ถูกต้อง -> ลบออก (ใช้ได้ครั้งเดียว)
function consumeBackupCode(user, code) {
  const h = hashCode(code);
  const i = (user.mfaBackupCodes || []).indexOf(h);
  if (i === -1) return false;
  user.mfaBackupCodes.splice(i, 1);
  return true;
}

module.exports = {
  MAX_FAILED, LOCK_MINUTES, clientIp, ipBlocked, ipFailed, ipReset, isLocked, registerFailure,
  registerSuccess, minutesLeft, logLogin, newSecret, otpauthUrl, verifyTotp, newBackupCodes, consumeBackupCode
};
