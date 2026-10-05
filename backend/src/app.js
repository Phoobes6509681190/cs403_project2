require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");


const app = express();

const PORT = process.env.PORT || 3000;
const allowedOrigins = new Set(
  (process.env.FRONTEND_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));

const assetRoutes = require("./routes/asset.routes");
const authRoutes = require("./routes/auth.routes");
const inspectionRoutes = require("./routes/inspection.routes");
const userRoutes = require("./routes/user.routes");
const reportRoutes = require("./routes/report.routes");

app.use("/api/inspections", inspectionRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) => {
  const mongoStatus =
    mongoose.connection.readyState === 1
      ? "connected"
      : "disconnected";

  res.json({
    success: true,
    message: "AIMSlog API is running",
    database: mongoStatus
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const isCorsError = error.message === "Origin is not allowed by CORS";
  const statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : isCorsError ? 403 : 400;
  res.status(statusCode).json({ success: false, message: error.message || "Request failed" });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected!");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  });