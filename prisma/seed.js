const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Memulai seeding database...");

  // =====================================================
  // 1. BERSIHKAN DATA LAMA
  // =====================================================

  await prisma.penyaluranBantuan.deleteMany();
  await prisma.donasi.deleteMany();
  await prisma.penerimaBantuan.deleteMany();
  await prisma.programDonasi.deleteMany();
  await prisma.user.deleteMany();

  console.log("🧹 Data lama dibersihkan");

  // =====================================================
  // 2. USER
  // =====================================================

  await prisma.user.createMany({
    data: [
      {
        id: 1,
        nama: "Pengurus Yayasan",
        email: "admin@yayasan.com",
        password:
          "$2b$10$D6oRAxiAIgIGkwX.4esgsuhKDNNXubwEEksY965otro89ecpQmmdW",
        role: "PENGURUS",
        createdAt: new Date("2026-09-14T17:41:21.695Z"),
      },
      {
        id: 2,
        nama: "Budi Santoso",
        email: "budi@gmail.com",
        password:
          "$2b$10$D6oRAxiAIgIGkwX.4esgsuhKDNNXubwEEksY965otro89ecpQmmdW",
        role: "DONATUR",
        createdAt: new Date("2026-09-14T17:58:03.266Z"),
      },
      {
        id: 3,
        nama: "Siti Aminah",
        email: "siti@gmail.com",
        password:
          "$2b$10$D6oRAxiAIgIGkwX.4esgsuhKDNNXubwEEksY965otro89ecpQmmdW",
        role: "PENERIMA_BANTUAN",
        createdAt: new Date("2026-09-14T18:04:31.269Z"),
      },
      {
        id: 5,
        nama: "donatur test",
        email: "donatur@gmail.com",
        password:
          "$2b$10$uGRYsB7ph9gWDnRc6/6xPOixDZxSYO9pJJIAG/3P6//AASCJAf3tO",
        role: "DONATUR",
        createdAt: new Date("2026-09-20T18:53:58.336Z"),
      },
      {
        id: 6,
        nama: "pbantuan",
        email: "pbantuan@gmail.com",
        password:
          "$2b$10$8Xitc5GoAE/5f36EWDlFH.3W4IqxeyvF7Ewv20hT8XRlFUHr9aPTa",
        role: "PENERIMA_BANTUAN",
        createdAt: new Date("2026-09-20T18:54:57.341Z"),
      },
      {
        id: 7,
        nama: "Yoms",
        email: "Yoms@yayasan.org",
        password:
          "$2b$10$D6oRAxiAIgIGkwX.4esgsuhKDNNXubwEEksY965otro89ecpQmmdW",
        role: "PENGURUS",
        createdAt: new Date("2026-09-20T19:13:11.759Z"),
      },
      {
        id: 17,
        nama: "Jamet2@yayasan.org",
        email: "Jamet2@yayasan.org",
        password:
          "$2b$10$uGRYsB7ph9gWDnRc6/6xPOixDZxSYO9pJJIAG/3P6//AASCJAf3tO",
        role: "DONATUR",
        createdAt: new Date("2026-09-22T18:34:07.301Z"),
      },
      {
        id: 18,
        nama: "goy",
        email: "goy@yayasan.org",
        password:
          "$2b$10$8Xitc5GoAE/5f36EWDlFH.3W4IqxeyvF7Ewv20hT8XRlFUHr9aPTa",
        role: "PENERIMA_BANTUAN",
        createdAt: new Date("2026-09-22T18:34:51.495Z"),
      },
      {
        id: 19,
        nama: "pbantuan1@gmail.com",
        email: "pbantuan1@gmail.com",
        password:
          "$2b$10$8Xitc5GoAE/5f36EWDlFH.3W4IqxeyvF7Ewv20hT8XRlFUHr9aPTa",
        role: "PENERIMA_BANTUAN",
        createdAt: new Date("2026-09-23T16:35:48.200Z"),
      },
    ],
  });

  console.log("👤 User berhasil dimasukkan");

  // =====================================================
  // 3. PROGRAM DONASI
  // =====================================================

  await prisma.programDonasi.createMany({
    data: [
      {
        id: 1,
        judul: "Bantuan Pangan Lansia 2026",
        deskripsi:
          "Program pengadaan paket sembako untuk lansia kurang mampu.",
        targetDana: 10000000,
        terkumpul: 3160000,
        createdAt: new Date("2026-09-14T17:55:09.942Z"),
      },
      {
        id: 2,
        judul: "Santunan Yatim & Dhuafa",
        deskripsi:
          "Program bantuan biaya pendidikan, kebutuhan pokok, dan perlengkapan sekolah bagi anak-anak yatim serta keluarga dhuafa.",
        targetDana: 15000000,
        terkumpul: 7020000,
        createdAt: new Date("2026-09-20T15:23:15.169Z"),
      },
      {
        id: 3,
        judul: "Pendidikan & Tahfidz Al-Qur'an",
        deskripsi:
          "Bantuan fasilitasi pembelajaran, kitab Al-Qur'an, dan beasiswa untuk santri penghafal Al-Qur'an.",
        targetDana: 20000000,
        terkumpul: 620000,
        createdAt: new Date("2026-09-20T15:23:15.169Z"),
      },
    ],
  });

  console.log("📢 Program donasi berhasil dimasukkan");

  // =====================================================
  // 4. PENERIMA BANTUAN
  // =====================================================

  await prisma.penerimaBantuan.createMany({
    data: [
      {
        id: 1,
        userId: 3,
        alamat: "Jl. Mawar No. 12, Jakarta",
        noHp: "081234567890",
        alasan: "Janda lansia tidak memiliki penghasilan tetap",
        status: "DISETUJUI",
      },
      {
        id: 2,
        userId: 6,
        alamat: "Bogor",
        noHp: "08980980",
        alasan: "Belum makan",
        status: "DITOLAK",
      },
      {
        id: 6,
        userId: 18,
        alamat: "goy@yayasan.org",
        noHp: "5454",
        alasan: "goy@yayasan.org",
        status: "VERIFIKASI",
      },
      {
        id: 7,
        userId: 19,
        alamat: "asas",
        noHp: "7876",
        alasan: "asasa",
        status: "VERIFIKASI",
      },
    ],
  });

  console.log("🤝 Penerima bantuan berhasil dimasukkan");

  // =====================================================
  // 5. DONASI
  // =====================================================

  await prisma.donasi.createMany({
    data: [
      {
        id: 1,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-14T18:03:15.219Z"),
        donaturId: 2,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "TRANSFER_BANK",
      },
      {
        id: 2,
        jumlah: 20000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-20T15:08:03.295Z"),
        donaturId: 2,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 3,
        jumlah: 50000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-20T15:08:12.462Z"),
        donaturId: 2,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "TRANSFER_BSI",
      },
      {
        id: 4,
        jumlah: 50000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-20T15:24:16.510Z"),
        donaturId: 2,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "TRANSFER_BSI",
      },
      {
        id: 5,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-20T15:24:21.441Z"),
        donaturId: 2,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "TRANSFER_BSI",
      },
      {
        id: 6,
        jumlah: 50000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-20T15:24:26.216Z"),
        donaturId: 2,
        programId: 3,
        buktiPembayaran: null,
        metodePembayaran: "TRANSFER_BSI",
      },
      {
        id: 7,
        jumlah: 20000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-20T15:24:55.375Z"),
        donaturId: 2,
        programId: 3,
        buktiPembayaran: null,
        metodePembayaran: "TRANSFER_BSI",
      },
      {
        id: 8,
        jumlah: 250000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-20T19:11:58.049Z"),
        donaturId: 2,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 9,
        jumlah: 20000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-21T14:33:30.795Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 10,
        jumlah: 20000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-21T14:37:22.002Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 11,
        jumlah: 100000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-21T14:37:26.554Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 12,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-21T14:38:45.730Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 13,
        jumlah: 20000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-21T14:42:59.405Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 14,
        jumlah: 50000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T13:22:46.273Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 15,
        jumlah: 20000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T13:23:35.444Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 16,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T13:23:49.840Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 17,
        jumlah: 100000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T13:24:04.366Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 18,
        jumlah: 10000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T13:24:39.494Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 19,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T13:24:47.226Z"),
        donaturId: null,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 20,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T14:16:58.685Z"),
        donaturId: null,
        programId: 3,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 21,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T15:03:25.119Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 22,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T15:03:46.302Z"),
        donaturId: null,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 23,
        jumlah: 50000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T16:10:30.175Z"),
        donaturId: null,
        programId: 3,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 24,
        jumlah: 20000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T16:47:55.872Z"),
        donaturId: null,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 25,
        jumlah: 50000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T17:20:45.440Z"),
        donaturId: null,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 26,
        jumlah: 5000000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T17:37:15.895Z"),
        donaturId: null,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 27,
        jumlah: 200000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T18:07:29.698Z"),
        donaturId: null,
        programId: 2,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 28,
        jumlah: 200000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-22T18:27:33.700Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
      {
        id: 29,
        jumlah: 500000,
        status: "BERHASIL",
        createdAt: new Date("2026-09-23T16:31:15.747Z"),
        donaturId: null,
        programId: 1,
        buktiPembayaran: null,
        metodePembayaran: "QRIS",
      },
    ],
  });

  console.log("💰 Donasi berhasil dimasukkan");

  // =====================================================
  // 6. PENYALURAN BANTUAN
  // =====================================================

  await prisma.penyaluranBantuan.createMany({
    data: [
      {
        id: 1,
        jumlahBantuan: 250000,
        tanggalSalur: new Date("2026-09-14T18:06:08.871Z"),
        keterangan: "Penyaluran sembako tahap 1",
        programId: 1,
        penerimaId: 1,
      },
      {
        id: 2,
        jumlahBantuan: 700000,
        tanggalSalur: new Date("2026-09-22T17:11:17.942Z"),
        keterangan: "Santunan",
        programId: 2,
        penerimaId: 1,
      },
    ],
  });

  console.log("📦 Penyaluran bantuan berhasil dimasukkan");

  console.log("====================================");
  console.log("🎉 SEEDING SELESAI!");
  console.log("====================================");
}

module.exports = main;

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("❌ Seeding gagal:");
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
