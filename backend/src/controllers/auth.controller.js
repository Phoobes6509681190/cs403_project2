const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// อายุ session — ตกลงกันไว้ 8 ชั่วโมง (1 วันทำงาน) ปรับได้ผ่าน .env
const SESSION_HOURS = Number(process.env.SESSION_HOURS || 8);

const cookieBase = () => ({
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax", // หน้าเว็บกับ API อยู่โดเมนเดียวกันผ่าน proxy (Vite dev / Vercel rewrites)
  path: "/",
  maxAge: SESSION_HOURS * 60 * 60 * 1000
});

const publicUser = (u) => ({ id: u._id, username: u.username, name: u.name, role: u.role });

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }

    const user = await User.findOne({ username: String(username).trim() });
    const ok = user && (await bcrypt.compare(String(password), user.password));
    if (!ok) {
      return res.status(401).json({ success: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: `${SESSION_HOURS}h` }
    );

    res.cookie("token", token, { ...cookieBase(), httpOnly: true });
    res.cookie("csrfToken", crypto.randomBytes(24).toString("hex"), { ...cookieBase(), httpOnly: false });

    res.json({ success: true, user: publicUser(user) });
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
    if (!user) return res.status(401).json({ success: false, message: "ไม่พบผู้ใช้" });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
