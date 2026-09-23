const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const programController = require("../controllers/programController");
const donasiController = require("../controllers/donasiController");
const adminController = require("../controllers/adminController");
const { authenticateToken, isAdmin } = require("../middleware/authMiddleware");

// --- ROUTES AUTENTIKASI ---
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.post("/auth/forgot-password", authController.forgotPassword);
router.post("/auth/reset-password", authController.resetPasswordWithToken);

// --- ROUTES PROGRAM DONASI ---
router.get("/program", programController.getAllProgram);
router.post(
  "/program",
  authenticateToken,
  isAdmin,
  programController.createProgram,
);

// --- ROUTES DONASI & PENYALURAN ---
// Middleware authenticateToken dibuang agar publik/anonim bisa donasi
router.post("/donasi", donasiController.createDonasi);

router.get(
  "/donasi/saya",
  authenticateToken,
  donasiController.getRiwayatDonatur,
);
router.get("/donasi/transparansi", donasiController.getLaporanTransparansi);
router.post(
  "/penyaluran",
  authenticateToken,
  isAdmin,
  donasiController.createPenyaluran,
);

// --- ROUTES MANAJEMEN USER & PENGURUS (KHUSUS ADMIN) ---
router.get(
  "/admin/pengurus",
  authenticateToken,
  isAdmin,
  adminController.getDaftarPengurus,
);
router.post(
  "/admin/pengurus",
  authenticateToken,
  isAdmin,
  adminController.tambahPengurus,
);
router.put(
  "/admin/pengurus/:id/reset-password",
  authenticateToken,
  isAdmin,
  adminController.resetPasswordPengurus,
);
router.get(
  "/admin/summary-keuangan",
  authenticateToken,
  isAdmin,
  adminController.getSummaryKeuangan,
);

router.get(
  "/admin/pengurus",
  authenticateToken,
  isAdmin,
  adminController.getDaftarPengurus,
);

// 🟢 RUTE TAMBAHAN: MANAJEMEN PENERIMA BANTUAN & DONATUR
router.get(
  "/admin/penerima",
  authenticateToken,
  isAdmin,
  adminController.getDaftarPenerima,
);
router.get(
  "/admin/donatur",
  authenticateToken,
  isAdmin,
  adminController.getDaftarDonatur,
);
router.get(
  "/admin/penerima-pending",
  authenticateToken,
  isAdmin,
  adminController.getPenerimaBantuanPending,
);
router.put(
  "/admin/verifikasi-penerima/:id",
  authenticateToken,
  isAdmin,
  adminController.verifikasiPenerimaBantuan,
);
router.put(
  "/admin/user/:id",
  authenticateToken,
  isAdmin,
  adminController.updateUser,
);
router.delete(
  "/admin/user/:id",
  authenticateToken,
  isAdmin,
  adminController.hapusUser,
);

// --- ROUTES EXPORT LAPORAN ---
router.get(
  "/laporan/pdf",
  authenticateToken,
  isAdmin,
  donasiController.exportPDF,
);
router.get(
  "/laporan/excel",
  authenticateToken,
  isAdmin,
  donasiController.exportExcel,
);

// Check Connection with Database --
app.get("/health/db", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;


