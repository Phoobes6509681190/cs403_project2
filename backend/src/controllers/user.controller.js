const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const User = require("../models/User");

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const dto = (u) => ({
  id: String(u._id), username: u.username, name: u.name, role: u.role,
  position: u.position || "", email: u.email || "", phone: u.phone || "",
  avatar: u.avatar || "", active: u.active !== false
});

// GET /api/users (admin) — ?active=1 เฉพาะบัญชีที่เปิดใช้ (ใช้เลือกกรรมการ / ผู้ถือครอง)
exports.list = async (req, res) => {
  try {
    const filter = req.query.active ? { active: { $ne: false } } : {};
    const users = await User.find(filter, { password: 0 }).sort({ role: 1, name: 1 }).lean();
    res.json({ success: true, items: users.map(dto) });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/users (admin) body: { username, name, password, role, position }
exports.create = async (req, res) => {
  try {
    const { username, name, password, role = "user", position } = req.body || {};
    if (!username || !name || !password) return fail(res, 400, "กรอกชื่อผู้ใช้ ชื่อ-สกุล และรหัสผ่านให้ครบ");
    if (String(password).length < 8) return fail(res, 400, "รหัสผ่านอย่างน้อย 8 ตัวอักษร");
    if (!["admin", "user"].includes(role)) return fail(res, 400, "สิทธิ์ไม่ถูกต้อง");
    if (await User.exists({ username: String(username).trim() })) return fail(res, 409, "ชื่อผู้ใช้นี้มีอยู่แล้ว");
    const user = await User.create({
      username: String(username).trim(),
      name: String(name).trim(),
      position: position ? String(position).trim() : undefined,
      role,
      password: await bcrypt.hash(String(password), 10),
      mustChangePassword: true // รหัสเริ่มต้นที่ Admin ตั้ง -> ผู้ใช้ต้องเปลี่ยนเองตอน login ครั้งแรก
    });
    res.status(201).json(dto(user));
  } catch (error) {
    fail(res, 400, error.message);
  }
};

// PUT /api/users/:id (admin) body: { role?, active? } — เปลี่ยนสิทธิ์ / ปิด-เปิดบัญชี
exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "ไม่พบผู้ใช้");
    if (String(req.params.id) === String(req.user.userId)) {
      return fail(res, 400, "เปลี่ยนสิทธิ์หรือปิดบัญชีของตัวเองไม่ได้ (กันล็อกตัวเองออกจากระบบ)");
    }
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, "ไม่พบผู้ใช้");
    const { role, active } = req.body || {};
    if (role !== undefined) {
      if (!["admin", "user"].includes(role)) return fail(res, 400, "สิทธิ์ไม่ถูกต้อง");
      user.role = role;
    }
    if (active !== undefined) user.active = !!active;
    await user.save();
    res.json(dto(user));
  } catch (error) {
    fail(res, 400, error.message);
  }
};

// PUT /api/users/:id/password (admin) body: { newPassword } — ตั้งรหัสใหม่ให้ผู้ใช้ที่ลืมรหัส
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body || {};
    if (!newPassword || String(newPassword).length < 8) return fail(res, 400, "รหัสผ่านอย่างน้อย 8 ตัวอักษร");
    if (!mongoose.isValidObjectId(req.params.id)) return fail(res, 404, "ไม่พบผู้ใช้");
    const user = await User.findById(req.params.id);
    if (!user) return fail(res, 404, "ไม่พบผู้ใช้");
    user.password = await bcrypt.hash(String(newPassword), 10);
    user.mustChangePassword = true;
    user.passwordResetAt = new Date();
    await user.save();
    res.json({ success: true });
  } catch (error) {
    fail(res, 500, error.message);
  }
};
