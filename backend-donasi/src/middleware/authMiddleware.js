const jwt = require("jsonwebtoken");
const { PERMISSIONS, can, isFullAccess } = require("../roles");

// Middleware 1: Verifikasi apakah User sudah Login (punya Token JWT valid)
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Format: Bearer <TOKEN>

  if (!token) {
    return res
      .status(401)
      .json({ message: "Akses ditolak! Token tidak ditemukan." });
  }

  const secretKey = process.env.JWT_SECRET;
  if (!secretKey) {
    return res
      .status(500)
      .json({ message: "Konfigurasi server bermasalah: JWT_SECRET belum diatur." });
  }

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

// Middleware 2: Verifikasi apakah User memiliki akses penuh (Admin Sistem / akun Pengurus lama)
exports.isAdmin = (req, res, next) => {
  if (!req.user || !isFullAccess(req.user.role)) {
    return res
      .status(403)
      .json({ message: "Akses ditolak! Khusus Admin Sistem." });
  }
  next();
};

// Middleware 3: Izinkan hanya role yang punya hak akses tertentu (RBAC).
// Contoh: router.put("/donasi/:id/verifikasi", authenticateToken, authorize("VERIFIKASI_DONASI"), ...)
exports.authorize = (permission) => {
  if (!PERMISSIONS[permission]) throw new Error(`Permission tidak dikenal: ${permission}`);
  return (req, res, next) => {
    if (!req.user || !can(req.user.role, permission)) {
      return res.status(403).json({
        message: "Akses ditolak: Anda tidak memiliki wewenang untuk tindakan ini.",
      });
    }
    next();
  };
};
