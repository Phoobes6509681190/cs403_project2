const bcrypt = require("bcrypt");
const User = require("../models/User");

const fail = (res, code, message) => res.status(code).json({ success: false, message });
const dto = (u) => ({ id: String(u._id), username: u.username, name: u.name, role: u.role });

// GET /api/users (admin) — ใช้เลือกกรรมการ / ผูกบัญชีผู้ถือครอง
exports.list = async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }).sort({ role: 1, name: 1 }).lean();
    res.json({ success: true, items: users.map(dto) });
  } catch (error) {
    fail(res, 500, error.message);
  }
};

// POST /api/users (admin) body: { username, name, password, role }
exports.create = async (req, res) => {
  try {
    const { username, name, password, role = "user" } = req.body || {};
    if (!username || !name || !password) return fail(res, 400, "กรอกชื่อผู้ใช้ ชื่อ-สกุล และรหัสผ่านให้ครบ");
    if (String(password).length < 6) return fail(res, 400, "รหัสผ่านอย่างน้อย 6 ตัวอักษร");
    if (!["admin", "user"].includes(role)) return fail(res, 400, "สิทธิ์ไม่ถูกต้อง");
    if (await User.exists({ username: String(username).trim() })) return fail(res, 409, "ชื่อผู้ใช้นี้มีอยู่แล้ว");
    const user = await User.create({
      username: String(username).trim(),
      name: String(name).trim(),
      role,
      password: await bcrypt.hash(String(password), 10)
    });
    res.status(201).json(dto(user));
  } catch (error) {
    fail(res, 400, error.message);
  }
};
