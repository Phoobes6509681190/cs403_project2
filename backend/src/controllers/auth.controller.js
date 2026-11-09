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

const publicUser = (u) => ({
  id: u._id, username: u.username, name: u.name, role: u.role,
  position: u.position || "", email: u.email || "", phone: u.phone || "", bio: u.bio || "", avatar: u.avatar || ""
});
exports.publicUser = publicUser;

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ success: false, message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }

    const user = await User.findOne({ username: String(username).trim() });
    const ok = user && user.active !== false && (await bcrypt.compare(String(password), user.password));
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
    await user.save();
    res.json({ success: true });
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
