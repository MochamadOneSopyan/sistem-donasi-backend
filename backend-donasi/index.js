const express = require("express");
const cors = require("cors");
require("dotenv").config();

const apiRoutes = require("./src/routes/api");
const { getUploadsDir } = require("./src/uploadPaths");

const app = express();

let configuredClientOrigin;
try {
  configuredClientOrigin = new URL(process.env.CLIENT_URL).origin;
} catch {
  configuredClientOrigin = null;
}

const allowedOrigins = [
  "https://yayasanmuliakaryabersama.netlify.app",
  "https://sistem-donasi-yayasan.vercel.app",
  "https://sistem-donasi-frontend-production.up.railway.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5174",
  configuredClientOrigin,
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

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Bukti pembayaran berisi data transaksi pribadi dan hanya dilayani lewat API berizin.
app.use("/uploads/bukti", (_req, res) => res.status(403).json({ message: "Bukti pembayaran memerlukan akses akun." }));
// Gambar publik lainnya tetap tersedia.
app.use("/uploads", express.static(getUploadsDir()));

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
        \`role\` ENUM('DONATUR', 'PENERIMA_BANTUAN', 'ADMIN_SISTEM', 'BIDANG_INFORMATIKA', 'KETUA', 'BENDAHARA', 'SEKRETARIS', 'BIDANG_SOSIAL', 'BIDANG_PENDIDIKAN', 'BIDANG_KESEHATAN', 'HUMAS', 'PENGAWAS', 'PEMBINA') NOT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`programdonasi\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`judul\` VARCHAR(191) NOT NULL,
        \`deskripsi\` TEXT NOT NULL,
        \`imageUrl\` TEXT NULL,
        \`imagePublicId\` VARCHAR(191) NULL,
        \`targetDana\` DOUBLE NOT NULL,
        \`terkumpul\` DOUBLE NOT NULL DEFAULT 0,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`donasi\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`requestId\` VARCHAR(64) NULL UNIQUE,
        \`jumlah\` DOUBLE NOT NULL,
        \`metodePembayaran\` VARCHAR(191) NOT NULL DEFAULT 'TRANSFER_BANK',
        \`buktiPembayaran\` VARCHAR(191) NULL,
        \`status\` ENUM('PENDING', 'BERHASIL', 'GAGAL') NOT NULL DEFAULT 'PENDING',
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`donaturId\` INT NULL,
        \`programId\` INT NOT NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`penerimabantuan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`userId\` INT NOT NULL UNIQUE,
        \`alamat\` VARCHAR(191) NOT NULL,
        \`noHp\` VARCHAR(191) NOT NULL,
        \`alasan\` TEXT NOT NULL,
        \`status\` ENUM('VERIFIKASI', 'DISETUJUI', 'DITOLAK') NOT NULL DEFAULT 'VERIFIKASI'
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`penyaluranbantuan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`jumlahBantuan\` DOUBLE NOT NULL,
        \`tanggalSalur\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`keterangan\` VARCHAR(191) NOT NULL,
        \`programId\` INT NOT NULL,
        \`penerimaId\` INT NOT NULL
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

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
    if (!colNames.includes("fotoProfil")) {
      await prisma.$executeRawUnsafe("ALTER TABLE `user` ADD COLUMN `fotoProfil` TEXT NULL");
      console.log("✅ Kolom fotoProfil berhasil ditambahkan ke tabel user");
    }

    const donationColumns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `donasi`");
    if (!donationColumns.some((column) => column.Field === "requestId")) {
      await prisma.$executeRawUnsafe("ALTER TABLE `donasi` ADD COLUMN `requestId` VARCHAR(64) NULL UNIQUE");
      console.log("Kolom requestId berhasil ditambahkan ke tabel donasi");
    }

    const programColumns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `programdonasi`");
    if (!programColumns.some((column) => column.Field === "imageUrl")) {
      await prisma.$executeRawUnsafe("ALTER TABLE `programdonasi` ADD COLUMN `imageUrl` TEXT NULL");
      console.log("✅ Kolom imageUrl berhasil ditambahkan ke tabel programdonasi");
    }

    if (!programColumns.some((column) => column.Field === "imagePublicId")) {
      await prisma.$executeRawUnsafe("ALTER TABLE `programdonasi` ADD COLUMN `imagePublicId` VARCHAR(191) NULL");
      console.log("Kolom imagePublicId berhasil ditambahkan ke tabel programdonasi");
    }

    // 2b. Perluas enum role user untuk RBAC (jabatan pengurus)
    const roleColumns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `user` LIKE 'role'");
    if (roleColumns.length && (!String(roleColumns[0].Type).includes("'ADMIN_SISTEM'") || String(roleColumns[0].Type).includes("'PENGURUS'"))) {
      await prisma.$executeRawUnsafe("DELETE FROM `user` WHERE CAST(`role` AS CHAR) = 'PENGURUS'");
      await prisma.$executeRawUnsafe("ALTER TABLE `user` MODIFY COLUMN `role` ENUM('DONATUR', 'PENERIMA_BANTUAN', 'ADMIN_SISTEM', 'BIDANG_INFORMATIKA', 'KETUA', 'BENDAHARA', 'SEKRETARIS', 'BIDANG_SOSIAL', 'BIDANG_PENDIDIKAN', 'BIDANG_KESEHATAN', 'HUMAS', 'PENGAWAS', 'PEMBINA') NOT NULL");
      console.log("✅ Role RBAC (13 role murni) berhasil disinkronkan ke tabel user");
    }

    // 3. Tambah tabel pengajuanbantuan
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`pengajuanbantuan\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`userId\` INT NOT NULL,
        \`judul\` VARCHAR(191) NOT NULL,
        \`deskripsi\` TEXT NOT NULL,
        \`jumlahDiajukan\` DOUBLE NOT NULL,
        \`status\` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU',
        \`catatanAdmin\` TEXT NULL,
        \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
        CONSTRAINT \`fk_pengajuan_user\` FOREIGN KEY (\`userId\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);

    const applicationStatusColumns = await prisma.$queryRawUnsafe("SHOW COLUMNS FROM `pengajuanbantuan` LIKE 'status'");
    if (applicationStatusColumns.length && !String(applicationStatusColumns[0].Type).includes("'DIBATALKAN'")) {
      await prisma.$executeRawUnsafe("ALTER TABLE `pengajuanbantuan` MODIFY COLUMN `status` ENUM('MENUNGGU', 'DISETUJUI', 'DITOLAK', 'DIBATALKAN') NOT NULL DEFAULT 'MENUNGGU'");
      console.log("Status DIBATALKAN berhasil ditambahkan ke pengajuan bantuan");
    }

    // 4. Sinkronisasi 13 akun resmi pengurus & role RBAC
    const { syncRoleAccounts } = require("./scripts/seedRoleAccounts");
    await syncRoleAccounts();

    console.log("✅ Database schema sync selesai.");
  } catch (err) {
    console.error("Gagal menyinkronkan skema database:", err);
    throw err;
  }
}

// Hubungkan Rute API
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "API Sistem Donasi Yayasan Siap Digunakan!",
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  if (!process.env.DATABASE_URL?.startsWith("mysql://")) {
    throw new Error("DATABASE_URL harus memakai MySQL (mysql://) sesuai skema Prisma.");
  }
  await autoMigrate();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server berjalan di http://0.0.0.0:${PORT}`);
  });
}

start().catch(async (error) => {
  console.error("Server tidak dapat dimulai:", error);
  await require("./src/db").$disconnect();
  process.exitCode = 1;
});

module.exports = app;
