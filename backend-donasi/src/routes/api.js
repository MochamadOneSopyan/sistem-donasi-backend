const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const programController = require("../controllers/programController");
const donasiController = require("../controllers/donasiController");
const adminController = require("../controllers/adminController");
const { authenticateToken, isAdmin, authorize } = require("../middleware/authMiddleware");
const programImageUpload = require("../middleware/programImageUpload");
const blockDemoDonations = (_req, res, next) => {
  if (process.env.DEMO_MODE === "true") {
    return res.status(503).json({ message: "Donasi belum dibuka pada situs demo." });
  }
  next();
};

// --- ROUTES AUTENTIKASI ---
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.post("/auth/forgot-password", authController.forgotPassword);
router.post("/auth/reset-password", authController.resetPasswordWithToken);

// --- ROUTES PROFIL PENGGUNA (Login Wajib) ---
router.get("/profil", authenticateToken, adminController.getProfilSendiri);
router.put("/profil", authenticateToken, adminController.updateProfilSendiri);
router.put("/profil/ganti-password", authenticateToken, adminController.gantiPasswordSendiri);
router.put("/profil/foto", authenticateToken, adminController.uploadFotoProfil);
router.delete("/profil/foto", authenticateToken, adminController.hapusFotoProfil);

// --- ROUTES PROGRAM DONASI ---
router.get("/program", programController.getAllProgram);
router.post("/program", authenticateToken, authorize("KELOLA_PROGRAM"), programImageUpload, programController.createProgram);
router.put("/program/:id", authenticateToken, authorize("KELOLA_PROGRAM"), programImageUpload, programController.updateProgram);
router.delete("/program/:id", authenticateToken, authorize("KELOLA_PROGRAM"), programController.deleteProgram);

// --- ROUTES DONASI ---
router.post("/donasi", blockDemoDonations, donasiController.createDonasi);
router.put("/donasi/:id/bukti", donasiController.uploadBuktiDonasi);
router.get("/donasi/:id/bukti", authenticateToken, donasiController.getBuktiDonasi);
router.delete("/donasi/:id/bukti", authenticateToken, authorize("VERIFIKASI_DONASI"), donasiController.deleteBuktiDonasi);
router.get("/donasi/saya", authenticateToken, donasiController.getRiwayatDonatur);
router.get("/donasi/transparansi", donasiController.getLaporanTransparansi);

// Admin verifikasi donasi (FIX BUG: saldo hanya bertambah setelah diverifikasi)
router.put("/donasi/:id/verifikasi", authenticateToken, authorize("VERIFIKASI_DONASI"), donasiController.verifikasiDonasi);

// --- ROUTES PENYALURAN ---
router.post("/penyaluran", authenticateToken, authorize("KELOLA_PENYALURAN"), donasiController.createPenyaluran);
router.get("/penyaluran/saya", authenticateToken, donasiController.getPenyaluranSaya);

// --- ROUTES PENGAJUAN BANTUAN ---
// Penerima: buat & lihat pengajuan milik sendiri
router.post("/pengajuan", authenticateToken, adminController.buatPengajuan);
router.get("/pengajuan/saya", authenticateToken, adminController.getPengajuanSaya);
router.patch("/pengajuan/:id/batalkan", authenticateToken, adminController.batalkanPengajuan);

// Admin: lihat semua & verifikasi pengajuan
router.get("/admin/pengajuan", authenticateToken, authorize("LIHAT_PENGAJUAN"), adminController.getAllPengajuan);
router.put("/admin/pengajuan/:id/verifikasi", authenticateToken, authorize("VERIFIKASI_PENGAJUAN"), adminController.verifikasiPengajuan);

// --- ROUTES MANAJEMEN USER & PENGURUS (KHUSUS ADMIN SISTEM) ---
router.get("/admin/pengurus", authenticateToken, isAdmin, adminController.getDaftarPengurus);
router.post("/admin/pengurus", authenticateToken, isAdmin, adminController.tambahPengurus);
router.put("/admin/pengurus/:id/reset-password", authenticateToken, isAdmin, adminController.resetPasswordPengurus);
router.get("/admin/summary-keuangan", authenticateToken, authorize("LIHAT_RINGKASAN"), adminController.getSummaryKeuangan);

// Manajemen penerima, donatur, dan donasi
router.get("/admin/penerima", authenticateToken, authorize("LIHAT_PENERIMA"), adminController.getDaftarPenerima);
router.get("/admin/donatur", authenticateToken, authorize("LIHAT_DONATUR"), adminController.getDaftarDonatur);
router.get("/admin/donasi", authenticateToken, authorize("LIHAT_DONASI"), donasiController.getAllDonasi);
router.get("/admin/penerima-pending", authenticateToken, authorize("LIHAT_PENERIMA"), adminController.getPenerimaBantuanPending);
router.put("/admin/verifikasi-penerima/:id", authenticateToken, authorize("KELOLA_PENERIMA"), adminController.verifikasiPenerimaBantuan);
router.put("/admin/user/:id", authenticateToken, isAdmin, adminController.updateUser);
router.delete("/admin/user/:id", authenticateToken, isAdmin, adminController.hapusUser);

// --- ROUTES EXPORT LAPORAN ---
router.get("/laporan/pdf", authenticateToken, authorize("LIHAT_LAPORAN"), donasiController.exportPDF);
router.get("/laporan/excel", authenticateToken, authorize("LIHAT_LAPORAN"), donasiController.exportExcel);

// --- ROUTE HEALTH CHECK DATABASE ---
router.get("/health/db", async (req, res) => {
  try {
    const prisma = require("../db.js");
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok", database: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

module.exports = router;
