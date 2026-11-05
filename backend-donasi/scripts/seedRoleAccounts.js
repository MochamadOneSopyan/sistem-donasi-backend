// Membuat ke-13 akun untuk setiap role RBAC sesuai Struktur Pengurus Yayasan Mulia Karya Bersama
// dan Daftar_Akun_Role_Sistem_Donasi.xlsx.
//
// Jalankan: npm run seed:roles

require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("../src/db");
const { ALL_ROLES } = require("../src/roles");

const ACCOUNTS = [
  {
    nama: "H. Ahmad Subandi",
    jabatan: "Pembina",
    role: "PEMBINA",
    email: "pembina@yayasan.org",
    password: "PembinaYMK2026!",
    tugas: "Memberikan arahan dan pembinaan terhadap perkembangan yayasan.",
  },
  {
    nama: "H. Zainur Rochman, S.Mi",
    jabatan: "Pengawas",
    role: "PENGAWAS",
    email: "pengawas@yayasan.org",
    password: "PengawasYMK2026!",
    tugas: "Melakukan pengawasan dan evaluasi kegiatan yayasan.",
  },
  {
    nama: "Ust. Tarjoni Mista",
    jabatan: "Ketua",
    role: "KETUA",
    email: "ketua@yayasan.org",
    password: "KetuaYMK2026!",
    tugas: "Mengkoordinasikan dan memimpin seluruh kegiatan yayasan.",
  },
  {
    nama: "Sugeng Hidayat, ST",
    jabatan: "Sekretaris",
    role: "SEKRETARIS",
    email: "sekretaris@yayasan.org",
    password: "SekretarisYMK2026!",
    tugas: "Mengelola administrasi dan dokumentasi kegiatan yayasan.",
  },
  {
    nama: "Ust. M. Isro Tedi Darmadi",
    jabatan: "Bendahara",
    role: "BENDAHARA",
    email: "bendahara@yayasan.org",
    password: "BendaharaYMK2026!",
    tugas: "Mengelola pencatatan dan laporan keuangan yayasan.",
  },
  {
    nama: "Linda Puspita Sari, Amd. Kg",
    jabatan: "Bidang Kesehatan",
    role: "BIDANG_KESEHATAN",
    email: "bidang.kesehatan@yayasan.org",
    password: "KesehatanYMK2026!",
    tugas: "Mengelola kegiatan yayasan yang berkaitan dengan bidang kesehatan.",
  },
  {
    nama: "Ustz. Tuginem",
    jabatan: "Bidang Pendidikan",
    role: "BIDANG_PENDIDIKAN",
    email: "bidang.pendidikan@yayasan.org",
    password: "PendidikanYMK2026!",
    tugas: "Mengelola kegiatan pendidikan dan pembelajaran Al-Qur'an.",
  },
  {
    nama: "Sondi, Amd. Kom",
    jabatan: "Bidang Informatika",
    role: "BIDANG_INFORMATIKA",
    email: "bidang.it@yayasan.org",
    password: "TeknologiYMK2026!",
    tugas: "Mengelola kebutuhan teknologi informasi dan media digital yayasan.",
  },
  {
    nama: "Rusito",
    jabatan: "Bidang Sosial",
    role: "BIDANG_SOSIAL",
    email: "bidang.sosial@yayasan.org",
    password: "SosialYMK2026!",
    tugas: "Mengelola kegiatan sosial dan penyaluran bantuan masyarakat.",
  },
  {
    nama: "Agus Maryadi",
    jabatan: "Humas",
    role: "HUMAS",
    email: "humas@yayasan.org",
    password: "HumasYMK2026!",
    tugas: "Mengelola komunikasi dan publikasi kegiatan yayasan.",
  },
  {
    nama: "Admin Sistem Yayasan",
    jabatan: "Admin Sistem",
    role: "ADMIN_SISTEM",
    email: "admin.sistem@yayasan.org",
    password: "AdminYMK2026!",
    tugas: "Mengelola akun pengguna, konfigurasi sistem, dan hak akses penuh.",
  },
  {
    nama: "Donatur Demo",
    jabatan: "Donatur (Demo)",
    role: "DONATUR",
    email: "donatur.demo@gmail.com",
    password: "Donatur2026!",
    tugas: "Melakukan donasi, unggah bukti bayar, dan melihat riwayat transaksi.",
  },
  {
    nama: "Penerima Bantuan Demo",
    jabatan: "Penerima Bantuan (Demo)",
    role: "PENERIMA_BANTUAN",
    email: "mustahik.demo@gmail.com",
    password: "Mustahik2026!",
    tugas: "Mengajukan permohonan bantuan dan memantau status pengajuan.",
    penerimaBantuan: { alamat: "Alamat demo", noHp: "080000000000", alasan: "Akun demo pengujian", status: "DISETUJUI" },
  },
];

async function main() {
  // 1. Hapus akun PENGURUS lama & akun tes dummy lama sebelum memurnikan kolom ENUM
  const legacyEmails = [
    "admin@yayasan.com",
    "Yoms@yayasan.org",
    "Jamet2@yayasan.org",
    "goy@yayasan.org",
    "pbantuan@gmail.com",
    "pbantuan1@gmail.com",
  ];
  await prisma.penerimaBantuan.deleteMany({
    where: { user: { email: { in: legacyEmails } } },
  });
  await prisma.user.deleteMany({
    where: { email: { in: legacyEmails } },
  });
  const deletedLegacy = await prisma.$executeRawUnsafe(
    "DELETE FROM `user` WHERE CAST(`role` AS CHAR) = 'PENGURUS'",
  );
  if (deletedLegacy > 0) {
    console.log(`🗑️  Menghapus ${deletedLegacy} akun PENGURUS lama.`);
  }

  // 2. Pastikan kolom enum role di tabel user murni berisi 13 role RBAC
  const enumValues = ALL_ROLES.map((r) => `'${r}'`).join(", ");
  await prisma.$executeRawUnsafe(
    `ALTER TABLE \`user\` MODIFY COLUMN \`role\` ENUM(${enumValues}) NOT NULL`,
  );

  let created = 0;
  let updated = 0;
  for (const account of ACCOUNTS) {
    if (!ALL_ROLES.includes(account.role)) throw new Error(`Role tidak dikenal: ${account.role}`);

    const existing = await prisma.user.findUnique({ where: { email: account.email } });
    if (existing) {
      if (existing.nama !== account.nama || existing.role !== account.role) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { nama: account.nama, role: account.role },
        });
        updated += 1;
        console.log(`🔄 Diperbarui ${account.email} -> ${account.nama} (${account.role})`);
      } else {
        console.log(`⏭️  Tetap   ${account.email} (${account.nama} - ${account.role})`);
      }
      continue;
    }

    await prisma.user.create({
      data: {
        nama: account.nama,
        email: account.email,
        password: await bcrypt.hash(account.password, 10),
        role: account.role,
        ...(account.penerimaBantuan ? { penerimaBantuan: { create: account.penerimaBantuan } } : {}),
      },
    });
    created += 1;
    console.log(`✅ Dibuat ${account.email} (${account.nama} - ${account.role})`);
  }
  console.log(`\nSelesai: ${created} akun dibuat, ${updated} diperbarui.`);
}

module.exports = { ACCOUNTS, syncRoleAccounts: main };

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("❌ Gagal membuat akun role:", error.message);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
