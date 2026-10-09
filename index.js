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
      // Request tanpa origin, misalnya Postman atau server-to-server
      if (!origin) {
        return callback(null, true);
      }

      // Izinkan origin yang sudah terdaftar
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.endsWith(".netlify.app") ||
        origin.endsWith(".up.railway.app") ||
        origin.startsWith("http://localhost:")
      ) {
        return callback(null, true);
      }

      // Tolak origin yang tidak diizinkan
      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
  }),
);

app.use(express.json());

// Akses publik untuk folder uploads gambar
app.use("/uploads", express.static("uploads"));

// Fungsi sinkronisasi skema database otomatis (menambahkan kolom & tabel baru jika belum ada)
async function autoMigrate() {
  const prisma = require("./src/db");
  try {
    // 1. Buat tabel dasar jika belum ada sama sekali
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`user\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`nama\` VARCHAR(191) NOT NULL,
        \`email\` VARCHAR(191) NOT NULL UNIQUE,
        \`password\` VARCHAR(191) NOT NULL,
        \`noHp\` VARCHAR(191) NULL,
        \`alamat\` VARCHAR(191) NULL,
        \`role\` ENUM('PENGURUS', 'DONATUR', 'PENERIMA_BANTUAN') NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`programdonasi\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`judul\` VARCHAR(191) NOT NULL,
        \`deskripsi\` TEXT NOT NULL,
        \`targetDana\` DOUBLE NOT NULL,
        \`terkumpul\` DOUBLE NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`donasi\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`jumlah\` DOUBLE NOT NULL,
        \`metodePembayaran\` VARCHAR(191) NOT NULL DEFAULT 'TRANSFER_BANK',
        \`buktiPembayaran\` VARCHAR(191) NULL,
        \`status\` ENUM('PENDING', 'BERHASIL', 'GAGAL') NOT NULL DEFAULT 'PENDING',
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`donaturId\` INT NULL,
        \`programId\` INT NOT NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`penerimabantuan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`userId\` INT NOT NULL UNIQUE,
        \`alamat\` VARCHAR(191) NOT NULL,
        \`noHp\` VARCHAR(191) NOT NULL,
        \`alasan\` TEXT NOT NULL,
        \`status\` ENUM('VERIFIKASI', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'VERIFIKASI'
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch(() => {});

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`penyaluranbantuan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`jumlahBantuan\` DOUBLE NOT NULL,
        \`tanggalSalur\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`keterangan\` VARCHAR(191) NOT NULL,
        \`programId\` INT NOT NULL,
        \`penerimaId\` INT NOT NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch(() => {});

    // 2. Tambah kolom noHp & alamat ke tabel user jika belum ada
    const cols = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'user' AND TABLE_SCHEMA = DATABASE()
    `);
    const colNames = (cols || []).map((c) => c.COLUMN_NAME || c.column_name);

    if (!colNames.includes("noHp")) {
      await prisma.$executeRawUnsafe("ALTER TABLE `user` ADD COLUMN `noHp` VARCHAR(191) NULL");
      console.log("✅ Kolom noHp berhasil ditambahkan ke tabel user");
    }
    if (!colNames.includes("alamat")) {
      await prisma.$executeRawUnsafe("ALTER TABLE `user` ADD COLUMN `alamat` VARCHAR(191) NULL");
      console.log("✅ Kolom alamat berhasil ditambahkan ke tabel user");
    }

    // 3. Tambah tabel pengajuanbantuan
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`pengajuanbantuan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`userId\` INT NOT NULL,
        \`judul\` VARCHAR(191) NOT NULL,
        \`deskripsi\` TEXT NOT NULL,
        \`jumlahDiajukan\` DOUBLE NOT NULL,
        \`status\` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'MENUNGGU',
        \`catatanAdmin\` TEXT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT \`fk_pengajuan_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `).catch(() => {});

    console.log("✅ Database schema sync selesai.");
  } catch (err) {
    console.warn("⚠️ Warning autoMigrate:", err.message);
  }
}

// Endpoint manual untuk sinkronisasi database
app.get("/api/system/sync-db", async (req, res) => {
  try {
    await autoMigrate();
    res.json({ success: true, message: "Database schema berhasil disinkronkan!" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Hubungkan Rute API
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "API Sistem Donasi Yayasan Siap Digunakan!",
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", async () => {
  console.log(`🚀 Server berjalan di http://0.0.0.0:${PORT}`);
  await autoMigrate();
});
