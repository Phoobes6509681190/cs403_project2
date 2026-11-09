const jwt = require("jsonwebtoken");

// อ่าน JWT จาก httpOnly cookie "token" (ใช้จากหน้าเว็บ)
// หรือจาก header "Authorization: Bearer ..." (ใช้ทดสอบผ่าน Postman)
const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : null;
  const token = req.cookies?.token || bearer;

  if (!token) {
    return res.status(401).json({ success: false, message: "กรุณาเข้าสู่ระบบ" });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    req.authViaCookie = !bearer && !!req.cookies?.token;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  }
};

// ตรวจ CSRF แบบ double-submit cookie: คำขอที่แก้ข้อมูลต้องส่ง header X-CSRF-Token
// ให้ตรงกับ cookie csrfToken (เว็บอื่นอ่าน cookie ของเราไม่ได้ จึงปลอม header ไม่ได้)
// ใช้เฉพาะเมื่อยืนยันตัวตนด้วย cookie — ถ้าใช้ Bearer token ไม่มีความเสี่ยง CSRF
const csrfProtection = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.authViaCookie) return next();
  const cookieToken = req.cookies?.csrfToken;
  const headerToken = req.get("X-CSRF-Token");
  if (!cookieToken || cookieToken !== headerToken) {
    return res.status(403).json({ success: false, message: "CSRF token ไม่ถูกต้อง กรุณาโหลดหน้าใหม่" });
  }
  next();
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "ไม่มีสิทธิ์ใช้งานส่วนนี้" });
  }
  next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.csrfProtection = csrfProtection;
module.exports.requireRole = requireRole;
// บัญชีที่ต้องเปลี่ยนรหัสก่อน (รหัสชั่วคราวจาก Admin/สคริปต์กู้รหัส) เรียกได้เฉพาะ /api/auth/*
// (ดูตัวเอง, เปลี่ยนรหัส, ออกจากระบบ) — กันคนที่แอบรู้รหัสชั่วคราวเข้าไปใช้งานต่อ
const requirePasswordChanged = (req, res, next) => {
  if (req.user?.mcp && req.baseUrl !== "/api/auth") {
    return res.status(403).json({ success: false, code: "PASSWORD_CHANGE_REQUIRED", message: "กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน" });
  }
  next();
};

module.exports.requirePasswordChanged = requirePasswordChanged;
// ใช้ในทุก route ที่ต้อง login: router.use(...protect)
module.exports.protect = [authMiddleware, csrfProtection, requirePasswordChanged];
