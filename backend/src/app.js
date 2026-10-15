require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");


const app = express();

const PORT = process.env.PORT || 3000;



app.use(express.json());

const assetRoutes = require("./routes/asset.routes");
const authRoutes = require("./routes/auth.routes");

app.use("/api/auth", authRoutes);
app.use("/api/assets", assetRoutes);

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