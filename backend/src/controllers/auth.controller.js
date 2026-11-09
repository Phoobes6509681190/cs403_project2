const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sec = require("../services/security.service");

// อายุ session — ตกลงกันไว้ 8 ชั่วโมง (1 วันทำงาน) ปรับได้ผ่าน .env
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 8);

const cookieBase = () => ({
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax", // หน้าเว็บกับ API อยู่โดเมนเดียวกันผ่าน proxy (Vite dev / Vercel rewrites)
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60 * 1000
});

const publicUser = (u) => ({
  id: u._id, username: u.username, name: u.name, role: u.role,
  position: u.position || "", email: u.email || "", phone: u.phone || "", bio: u.bio || "", avatar: u.avatar || "",
  mustChangePassword: !!u.mustChangePassword,
  mfaEnabled: !!u.mfaEnabled
});

// ออก session ใหม่ (JWT ใน httpOnly cookie + CSRF token)
// mcp = must change password → middleware ยอมให้เรียกได้เฉพาะ /api/auth/* จนกว่าจะเปลี่ยนรหัส
function issueSession(res, user) {
  const token = jwt.sign(
    { userId: user._id, username: user.username, name: user.name, role: user.role, ...(user.mustChangePassword ? { mcp: true } : {}) },
    process.env.JWT_SECRET,
    { expiresIn: `${SESSION_HOURS}h` }
  );
  res.cookie("token", token, { ...cookieBase(), httpOnly: true });
  res.cookie("csrfToken", crypto.randomBytes(24).toString("hex"), { ...cookieBase(), httpOnly: false });
}
exports.publicUser = publicUser;

const GENERIC_FAIL = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
const lockedMsg = (user) => `บัญชีถูกล็อกชั่วคราวเพราะใส่รหัสผิดหลายครั้ง ลองใหม่ในอีก ${sec.minutesLeft(user)} นาที`;

// MFA token: ยืนยันรหัสผ่านแล้ว รอรหัส 6 หลัก (อายุ 5 นาที ใช้ได้แค่ขั้นยืนยัน MFA)
const signMfaToken = (user) => jwt.sign({ userId: user._id, purpose: "mfa" }, process.env.JWT_SECRET, { expiresIn: "5m" });

async function completeLogin(req, res, user, reason) {
  await sec.registerSuccess(user);
  sec.ipReset(sec.clientIp(req));
  issueSession(res, user);
  await sec.logLogin(req, { username: user.username, user, success: true, reason });
}

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }
    const ip = sec.clientIp(req);
    const uname = String(username).trim();

    if (sec.ipBlocked(ip)) {
      await sec.logLogin(req, { username: uname, success: false, reason: "ip_limited" });
      return res.status(429).json({ success: false, message: "พยายามเข้าสู่ระบบผิดหลายครั้งเกินไป กรุณารอ 15 นาที" });
    }

    const user = await User.findOne({ username: uname });
    if (!user) {
      sec.ipFailed(ip);
      await sec.logLogin(req, { username: uname, success: false, reason: "no_user" });
      return res.status(401).json({ success: false, message: GENERIC_FAIL });
    }
    if (sec.isLocked(user)) {
      await sec.logLogin(req, { username: uname, user, success: false, reason: "locked" });
      return res.status(429).json({ success: false, message: lockedMsg(user) });
    }

    const passwordOk = await bcrypt.compare(String(password), user.password);
    if (!passwordOk) {
      sec.ipFailed(ip);
      await sec.registerFailure(user);
      await sec.logLogin(req, { username: uname, user, success: false, reason: "wrong_password" });
      if (sec.isLocked(user)) return res.status(429).json({ success: false, message: lockedMsg(user) });
      return res.status(401).json({ success: false, message: GENERIC_FAIL });
    }
    if (user.active === false) {
      await sec.logLogin(req, { username: uname, user, success: false, reason: "inactive" });
      return res.status(401).json({ success: false, message: GENERIC_FAIL });
    }

    // เปิด MFA ไว้ -> ยังไม่ออก session ต้องยืนยันรหัส 6 หลักก่อน
    if (user.mfaEnabled) {
      return res.json({ success: true, mfaRequired: true, mfaToken: signMfaToken(user) });
    }

    await completeLogin(req, res, user, "ok");
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/mfa/verify body: { mfaToken, code } — รหัส 6 หลักจากแอป หรือรหัสสำรอง
exports.mfaVerify = async (req, res) => {
  try {
    const { mfaToken, code } = req.body || {};
    let payload;
    try {
      payload = jwt.verify(String(mfaToken || ""), process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, message: "หมดเวลายืนยัน กรุณาเข้าสู่ระบบใหม่" });
    }
    if (payload.purpose !== "mfa") return res.status(401).json({ success: false, message: "หมดเวลายืนยัน กรุณาเข้าสู่ระบบใหม่" });

    const user = await User.findById(payload.userId);
    if (!user || user.active === false || !user.mfaEnabled) {
      return res.status(401).json({ success: false, message: "หมดเวลายืนยัน กรุณาเข้าสู่ระบบใหม่" });
    }
    if (sec.isLocked(user)) return res.status(429).json({ success: false, message: lockedMsg(user) });

    const byApp = sec.verifyTotp(code, user.mfaSecret);
    const byBackup = !byApp && sec.consumeBackupCode(user, code);
    if (!byApp && !byBackup) {
      sec.ipFailed(sec.clientIp(req));
      await sec.registerFailure(user);
      await sec.logLogin(req, { username: user.username, user, success: false, reason: "mfa_failed" });
      if (sec.isLocked(user)) return res.status(429).json({ success: false, message: lockedMsg(user) });
      return res.status(401).json({ success: false, message: "รหัสยืนยันไม่ถูกต้อง" });
    }
    if (byBackup) await user.save();

    await completeLogin(req, res, user, byBackup ? "mfa_backup" : "mfa_ok");
    res.json({ success: true, user: publicUser(user), backupCodesLeft: byBackup ? user.mfaBackupCodes.length : undefined });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ---------- ตั้งค่า MFA ของตัวเอง ----------
const needPassword = async (user, password) => user && (await bcrypt.compare(String(password || ""), user.password));

// POST /api/auth/mfa/setup — สร้าง secret ใหม่ (ยังไม่เปิดใช้จนกว่าจะยืนยันรหัส)
exports.mfaSetup = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้" });
    if (user.mfaEnabled) return res.status(409).json({ success: false, message: "เปิดใช้ MFA อยู่แล้ว" });
    user.mfaPendingSecret = sec.newSecret();
    await user.save();
    res.json({ success: true, secret: user.mfaPendingSecret, otpauthUrl: sec.otpauthUrl(user.username, user.mfaPendingSecret) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/mfa/enable body: { code } — ยืนยันรหัสจากแอปครั้งแรก แล้วได้รหัสสำรอง (แสดงครั้งเดียว)
exports.mfaEnable = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user?.mfaPendingSecret) return res.status(400).json({ success: false, message: "กรุณาเริ่มตั้งค่า MFA ใหม่" });
    if (!sec.verifyTotp(req.body?.code, user.mfaPendingSecret)) {
      return res.status(400).json({ success: false, message: "รหัสไม่ถูกต้อง ตรวจว่าเวลาในมือถือถูกต้องแล้วลองใหม่" });
    }
    const codes = sec.newBackupCodes();
    user.mfaSecret = user.mfaPendingSecret;
    user.mfaPendingSecret = undefined;
    user.mfaEnabled = true;
    user.mfaBackupCodes = codes.hashed;
    await user.save();
    res.json({ success: true, backupCodes: codes.plain, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/mfa/disable body: { password }
exports.mfaDisable = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!(await needPassword(user, req.body?.password))) return res.status(400).json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaPendingSecret = undefined;
    user.mfaBackupCodes = [];
    await user.save();
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/auth/mfa/backup-codes body: { password } — สร้างรหัสสำรองชุดใหม่ (ชุดเก่าใช้ไม่ได้)
exports.mfaBackupCodes = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user?.mfaEnabled) return res.status(400).json({ success: false, message: "ยังไม่ได้เปิดใช้ MFA" });
    if (!(await needPassword(user, req.body?.password))) return res.status(400).json({ success: false, message: "รหัสผ่านไม่ถูกต้อง" });
    const codes = sec.newBackupCodes();
    user.mfaBackupCodes = codes.hashed;
    await user.save();
    res.json({ success: true, backupCodes: codes.plain });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.logout = (req, res) => {
  const { maxAge, ...opts } = cookieBase();
  res.clearCookie("token", { ...opts, httpOnly: true });
  res.clearCookie("csrfToken", opts);
  res.json({ success: true });
};

// GET /api/auth/me — ให้ frontend เช็คว่ายัง login อยู่ไหม (อ่าน httpOnly cookie เองไม่ได้)
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user || user.active === false) return res.status(401).json({ success: false, message: "ไม่พบผู้ใช้" });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/auth/password body: { currentPassword, newPassword } — เปลี่ยนรหัสผ่านของตัวเอง
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "กรอกรหัสผ่านเดิมและรหัสผ่านใหม่" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ success: false, message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ success: false, message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม" });
    }
    const user = await User.findById(req.user.userId);
    if (!user || !(await bcrypt.compare(String(currentPassword), user.password))) {
      return res.status(400).json({ success: false, message: "รหัสผ่านเดิมไม่ถูกต้อง" });
    }
    user.password = await bcrypt.hash(String(newPassword), 10);
    user.mustChangePassword = false;
    await user.save();
    issueSession(res, user); // token ใหม่ที่ไม่มีเงื่อนไข "ต้องเปลี่ยนรหัส"
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/auth/profile — แก้โปรไฟล์ของตัวเอง (ชื่อ ตำแหน่ง ติดต่อ แนะนำตัว รูป)
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ success: false, message: "ไม่พบผู้ใช้" });
    const b = req.body || {};
    for (const f of ["name", "position", "email", "phone", "bio"]) {
      if (b[f] !== undefined) user[f] = String(b[f]).trim();
    }
    if (!user.name) return res.status(400).json({ success: false, message: "ชื่อต้องไม่ว่าง" });
    if (b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
      return res.status(400).json({ success: false, message: "รูปแบบอีเมลไม่ถูกต้อง" });
    }
    if (b.avatar !== undefined) {
      if (b.avatar && !/^data:image\/(png|jpeg|webp);base64,/.test(b.avatar)) {
        return res.status(400).json({ success: false, message: "รูปโปรไฟล์ต้องเป็น PNG / JPEG / WebP" });
      }
      user.avatar = b.avatar || "";
    }
    await user.save();
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
