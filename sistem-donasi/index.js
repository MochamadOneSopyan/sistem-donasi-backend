const express = require("express");
const cors = require("cors");
require("dotenv").config();

const apiRoutes = require("./src/routes/api");

const app = express();

// 🟢 Perbarui CORS agar mengizinkan domain Netlify kamu dan localhost
app.use(
  cors({
    origin: [
      "https://yayasanmuliakaryabersama.netlify.app/", // Ganti dengan URL Netlify kamu nanti
      "http://localhost:5173",             // Untuk uji coba lokal
    ],
    credentials: true,
  })
);

app.use(express.json());

// 🟢 TAMBAHKAN INI: Agar folder penyimpanan file/gambar (misal: folder 'uploads') bisa diakses publik
// Sesuaikan "uploads" dengan nama folder tempat kamu menyimpan gambar di backend
app.use("/uploads", express.static("uploads"));

// Hubungkan Rute API
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API Sistem Donasi Yayasan Siap Digunakan!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
