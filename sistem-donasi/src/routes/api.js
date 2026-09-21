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
// 🟢 PERBAIKAN: Middleware authenticateToken DIBUANG agar publik/anonim bisa donasi
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

// --- ROUTES MANAJEMEN PENGURUS (KHUSUS ADMIN) ---
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

module.exports = router;
