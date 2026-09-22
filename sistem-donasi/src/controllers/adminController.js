const prisma = require("../db");
const bcrypt = require("bcryptjs");

// 1. PENGURUS MEMBUAT AKUN PENGURUS BARU
exports.tambahPengurus = async (req, res) => {
  try {
    const { nama, email, password } = req.body;

    if (!nama || !email || !password) {
      return res
        .status(400)
        .json({ message: "Nama, email, dan password wajib diisi." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email sudah digunakan oleh pengguna lain!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = await prisma.user.create({
      data: {
        nama,
        email,
        password: hashedPassword,
        role: "PENGURUS",
      },
    });

    res.status(201).json({
      message: "Akun pengurus baru berhasil dibuat!",
      data: {
        id: newAdmin.id,
        nama: newAdmin.nama,
        email: newAdmin.email,
        role: newAdmin.role,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal membuat akun pengurus", error: error.message });
  }
};

// 2. MENGAMBIL DAFTAR PENGURUS
exports.getDaftarPengurus = async (req, res) => {
  try {
    const pengurus = await prisma.user.findMany({
      where: { role: "PENGURUS" },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: pengurus });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil data pengurus", error: error.message });
  }
};

// 3. MENGAMBIL DAFTAR PENERIMA BANTUAN (SEMUA STATUS)
exports.getDaftarPenerima = async (req, res) => {
  try {
    const penerima = await prisma.user.findMany({
      where: { role: "PENERIMA_BANTUAN" },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        createdAt: true,
        penerimaBantuan: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: penerima });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data penerima bantuan.",
      error: error.message,
    });
  }
};

// 4. MENGAMBIL DAFTAR DONATUR
exports.getDaftarDonatur = async (req, res) => {
  try {
    const donatur = await prisma.user.findMany({
      where: { role: "DONATUR" },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: donatur });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Gagal mengambil data donatur.", error: error.message });
  }
};

// 5. MENGAMBIL DAFTAR PENERIMA BANTUAN PENDING (VERIFIKASI)
exports.getPenerimaBantuanPending = async (req, res) => {
  try {
    const listPending = await prisma.penerimaBantuan.findMany({
      where: {
        status: "VERIFIKASI",
      },
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true,
            createdAt: true,
          },
        },
      },
      orderBy: { id: "desc" },
    });

    res.json({ data: listPending });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil daftar penerima bantuan pending.",
      error: error.message,
    });
  }
};

// 6. MEMVERIFIKASI (DISETUJUI / DITOLAK) PENERIMA BANTUAN
exports.verifikasiPenerimaBantuan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["DISETUJUI", "DITOLAK"].includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid! Harus 'DISETUJUI' atau 'DITOLAK'.",
      });
    }

    const updatedProfil = await prisma.penerimaBantuan.update({
      where: { id: Number(id) },
      data: { status },
      include: { user: true },
    });

    res.json({
      message: `Akun penerima bantuan ${updatedProfil.user.nama} berhasil di-update menjadi ${status}!`,
      data: updatedProfil,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal melakukan verifikasi penerima bantuan.",
      error: error.message,
    });
  }
};

// 7. RESET PASSWORD USER (Dapat digunakan untuk Pengurus, Donatur, & Penerima Bantuan)
exports.resetPasswordPengurus = async (req, res) => {
  try {
    const { id } = req.params;
    const { passwordBaru } = req.body;

    if (!passwordBaru || passwordBaru.length < 6) {
      return res.status(400).json({
        message: "Password baru minimal 6 karakter.",
      });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: Number(id) },
    });

    if (!targetUser) {
      return res.status(404).json({
        message: "Pengguna tidak ditemukan.",
      });
    }

    const hashedPassword = await bcrypt.hash(passwordBaru, 10);

    await prisma.user.update({
      where: { id: Number(id) },
      data: { password: hashedPassword },
    });

    res.json({
      message: `Password untuk ${targetUser.nama} berhasil diperbarui!`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mereset password pengguna.",
      error: error.message,
    });
  }
};

// 8. EDIT / UPDATE AKUN USER
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, email, alamat, noHp, alasan } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: Number(id) },
      data: { nama, email },
    });

    if (updatedUser.role === "PENERIMA_BANTUAN") {
      await prisma.penerimaBantuan.updateMany({
        where: { userId: Number(id) },
        data: {
          alamat: alamat || "-",
          noHp: noHp || "-",
          alasan: alasan || "-",
        },
      });
    }

    res.json({
      message: `Data pengguna ${updatedUser.nama} berhasil diperbarui!`,
      data: updatedUser,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal memperbarui data pengguna.",
      error: error.message,
    });
  }
};

// 9. HAPUS AKUN USER
exports.hapusUser = async (req, res) => {
  try {
    const { id } = req.params;

    // Hapus relasi profil Penerima Bantuan terlebih dahulu jika ada
    await prisma.penerimaBantuan.deleteMany({
      where: { userId: Number(id) },
    });

    // Hapus data User dari database
    await prisma.user.delete({
      where: { id: Number(id) },
    });

    res.json({ message: "Akun pengguna berhasil dihapus dari sistem!" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal menghapus akun pengguna.",
      error: error.message,
    });
  }
};

// 10. MENDAPATKAN RINGKASAN KEUANGAN (TOTAL MASUK, KELUAR, SALDO)
exports.getSummaryKeuangan = async (req, res) => {
  try {
    // 1. Hitung total donasi masuk yang statusnya BERHASIL
    const donasiMasuk = await prisma.donasi.aggregate({
      where: { status: "BERHASIL" },
      _sum: { jumlah: true },
    });

    // 2. Hitung total penyaluran bantuan keluar
    const penyaluranKeluar = await prisma.penyaluranBantuan.aggregate({
      _sum: { jumlahBantuan: true },
    });

    const totalMasuk = donasiMasuk._sum.jumlah || 0;
    const totalKeluar = penyaluranKeluar._sum.jumlahBantuan || 0;
    const sisaSaldo = totalMasuk - totalKeluar;

    res.status(200).json({
      success: true,
      data: {
        totalMasuk,
        totalKeluar,
        sisaSaldo,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Gagal mengambil ringkasan keuangan.",
      error: error.message,
    });
  }
};
