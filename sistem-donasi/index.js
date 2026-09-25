const express = require("express");
const cors = require("cors");
require("dotenv").config();

const apiRoutes = require("./src/routes/api");

const app = express();
const allowedOrigins = [
  "https://yayasanmuliakaryabersama.netlify.app",
  "https://sistem-donasi-frontend-production.up.railway.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".netlify.app") ||
        origin.endsWith(".up.railway.app") ||
        origin.startsWith("http://localhost:")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json());

// Akses publik untuk folder uploads gambar
app.use("/uploads", express.static("uploads"));

// Hubungkan Rute API
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API Sistem Donasi Yayasan Siap Digunakan!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server berjalan di http://0.0.0.0:${PORT}`);
});
