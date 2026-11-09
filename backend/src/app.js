require("dotenv").config();
require("./config/dns");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const { ensureDefaultBudgets } = require("./services/budget.service");

const app = express();
const PORT = process.env.PORT || 4000;

// ปกติ Frontend เรียก API ผ่าน proxy โดเมนเดียวกัน (Vite dev server / Vercel rewrites)
// จึงไม่ต้องใช้ CORS — เปิดไว้เฉพาะ origin ที่กำหนดใน FRONTEND_ORIGIN (คั่นด้วย ,) เผื่อเรียกตรง
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "AIMSlog API is running",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/assets", require("./routes/asset.routes"));
app.use("/api/budgets", require("./routes/budget.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/inspections", require("./routes/inspection.routes"));
app.use("/api/reports", require("./routes/report.routes"));

app.use("/api", (req, res) => res.status(404).json({ success: false, message: "ไม่พบ API นี้" }));

// จัดการ error ที่หลุดมาจาก middleware (เช่น multer ไฟล์ใหญ่เกิน / นามสกุลไม่ถูก)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || (err.code === "LIMIT_FILE_SIZE" ? 400 : 500);
  const message = err.code === "LIMIT_FILE_SIZE" ? "ไฟล์ใหญ่เกิน 10 MB" : err.message;
  res.status(status).json({ success: false, message });
});

async function start() {
  if (!process.env.JWT_SECRET) throw new Error("ต้องตั้งค่า JWT_SECRET ใน .env");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connected!");
  await ensureDefaultBudgets();
  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Startup error:", error.message);
    process.exit(1);
  });
}

module.exports = app;
