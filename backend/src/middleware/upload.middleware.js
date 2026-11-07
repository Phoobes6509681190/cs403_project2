const multer = require("multer");

// เก็บไฟล์ไว้ใน memory — ดิสก์ของ Render ไม่ถาวร และเราอ่านไฟล์ทันทีอยู่แล้ว
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /\.(xlsx|xls|csv)$/i.test(file.originalname);
    cb(ok ? null : Object.assign(new Error("รองรับเฉพาะไฟล์ .xlsx .xls .csv"), { status: 400 }), ok);
  }
});

module.exports = upload;
