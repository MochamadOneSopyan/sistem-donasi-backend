const jwt = require("jsonwebtoken");

// Middleware 1: Verifikasi apakah User sudah Login (punya Token JWT valid)
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res
      .status(401)
      .json({ message: "Akses ditolak! Token tidak ditemukan." });
  }

  // Gunakan fallback key yang sama dengan authController.js
  const secretKey =
    process.env.JWT_SECRET || "kunci_rahasia_skripsi_yayasan_2026";

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res
        .status(403)
        .json({ message: "Token tidak valid atau sudah kadaluwarsa!" });
    }
    req.user = user;
    next();
  });
}; // <-- Penutup fungsi authenticateToken yang sebelumnya hilang

// Alias pendukung (opsional agar cocok jika ada controller yang memanggil verifyToken)
exports.verifyToken = exports.authenticateToken;

// Middleware 2: Verifikasi apakah User adalah PENGURUS (Admin Yayasan)
exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "PENGURUS") {
    return res
      .status(403)
      .json({ message: "Akses ditolak! Khusus Pengurus Yayasan." });
  }
  next();
};
