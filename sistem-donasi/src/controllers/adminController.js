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
    const donasiMasuk = await prisma.donasi.aggregate({
      where: { status: "BERHASIL" },
      _sum: { jumlah: true },
    });

    const penyaluranKeluar = await prisma.penyaluranBantuan.aggregate({
      _sum: { jumlahBantuan: true },
    });

    // Hitung donasi pending
    const donasiPending = await prisma.donasi.count({
      where: { status: "PENDING" },
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
        donasiPending,
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

// ==========================================
// FITUR PENGAJUAN BANTUAN
// ==========================================

// 11. Penerima mengajukan permohonan bantuan
exports.buatPengajuan = async (req, res) => {
  try {
    const userId = req.user.id;
    const { judul, deskripsi, jumlahDiajukan } = req.body;

    if (!judul || !deskripsi || !jumlahDiajukan) {
      return res.status(400).json({
        message: "Judul, deskripsi, dan jumlah yang diajukan wajib diisi.",
      });
    }

    if (parseFloat(jumlahDiajukan) <= 0) {
      return res.status(400).json({
        message: "Jumlah yang diajukan harus lebih dari 0.",
      });
    }

    const pengajuan = await prisma.pengajuanBantuan.create({
      data: {
        userId,
        judul,
        deskripsi,
        jumlahDiajukan: parseFloat(jumlahDiajukan),
        status: "MENUNGGU",
      },
      include: {
        user: { select: { id: true, nama: true, email: true } },
      },
    });

    res.status(201).json({
      message: "Pengajuan bantuan berhasil dikirim! Menunggu verifikasi admin.",
      data: pengajuan,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal membuat pengajuan bantuan.",
      error: error.message,
    });
  }
};

// 12. Penerima melihat daftar pengajuannya sendiri
exports.getPengajuanSaya = async (req, res) => {
  try {
    const userId = req.user.id;

    const pengajuanList = await prisma.pengajuanBantuan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ data: pengajuanList });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data pengajuan.",
      error: error.message,
    });
  }
};

// 13. Admin melihat semua pengajuan bantuan
exports.getAllPengajuan = async (req, res) => {
  try {
    const { status } = req.query;

    const where = status ? { status } : {};

    const pengajuanList = await prisma.pengajuanBantuan.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            nama: true,
            email: true,
            penerimaBantuan: {
              select: { alamat: true, noHp: true, status: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ data: pengajuanList });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data pengajuan.",
      error: error.message,
    });
  }
};

// 14. Admin verifikasi pengajuan bantuan (DISETUJUI / DITOLAK)
exports.verifikasiPengajuan = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, catatanAdmin } = req.body;

    if (!["DISETUJUI", "DITOLAK"].includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid! Harus 'DISETUJUI' atau 'DITOLAK'.",
      });
    }

    const pengajuan = await prisma.pengajuanBantuan.findUnique({
      where: { id: parseInt(id) },
    });

    if (!pengajuan) {
      return res
        .status(404)
        .json({ message: "Data pengajuan tidak ditemukan." });
    }

    if (pengajuan.status !== "MENUNGGU") {
      return res.status(400).json({
        message: `Pengajuan sudah diproses sebelumnya dengan status: ${pengajuan.status}`,
      });
    }

    const updated = await prisma.pengajuanBantuan.update({
      where: { id: parseInt(id) },
      data: {
        status,
        catatanAdmin: catatanAdmin || null,
      },
      include: {
        user: { select: { id: true, nama: true, email: true } },
      },
    });

    res.status(200).json({
      message: `Pengajuan bantuan dari ${updated.user.nama} berhasil di-${status.toLowerCase()}!`,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal memverifikasi pengajuan bantuan.",
      error: error.message,
    });
  }
};

// ==========================================
// FITUR PROFIL PENGGUNA
// ==========================================

// 15. User update profil sendiri
exports.updateProfilSendiri = async (req, res) => {
  try {
    const userId = req.user.id;
    const { nama, noHp, alamat } = req.body;

    if (!nama) {
      return res.status(400).json({ message: "Nama tidak boleh kosong." });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { nama, noHp: noHp || null, alamat: alamat || null },
      select: {
        id: true,
        nama: true,
        email: true,
        noHp: true,
        alamat: true,
        role: true,
      },
    });

    res.status(200).json({
      message: "Profil berhasil diperbarui!",
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal memperbarui profil.",
      error: error.message,
    });
  }
};

// 16. User ganti password sendiri
exports.gantiPasswordSendiri = async (req, res) => {
  try {
    const userId = req.user.id;
    const { passwordLama, passwordBaru } = req.body;

    if (!passwordLama || !passwordBaru) {
      return res.status(400).json({
        message: "Password lama dan password baru wajib diisi.",
      });
    }

    if (passwordBaru.length < 6) {
      return res.status(400).json({
        message: "Password baru minimal 6 karakter.",
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const isMatch = await bcrypt.compare(passwordLama, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Password lama tidak sesuai!" });
    }

    const hashedBaru = await bcrypt.hash(passwordBaru, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedBaru },
    });

    res
      .status(200)
      .json({ message: "Password berhasil diperbarui!" });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengganti password.",
      error: error.message,
    });
  }
};

// 17. Ambil profil sendiri
exports.getProfilSendiri = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nama: true,
        email: true,
        noHp: true,
        alamat: true,
        role: true,
        createdAt: true,
        penerimaBantuan: {
          select: {
            alamat: true,
            noHp: true,
            alasan: true,
            status: true,
          },
        },
        pengajuanBantuan: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    res.status(200).json({ data: user });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mengambil data profil.",
      error: error.message,
    });
  }
};

