const prisma = require("../db");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

// Helper simpan avatar file ke folder uploads/avatars/
function simpanAvatarFile(userId, dataUrl) {
  if (!dataUrl || typeof dataUrl !== "string") {
    throw new Error("Data gambar tidak ditemukan.");
  }

  // Validasi prefix data:image
  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
  let buffer;
  let ext = "jpg";

  if (matches) {
    const mimeSub = matches[1].toLowerCase();
    // Validasi format yang diizinkan: jpeg, jpg, png, webp
    if (!["jpeg", "jpg", "png", "webp"].includes(mimeSub)) {
      throw new Error(
        "Format gambar tidak didukung. Harap gunakan format JPG, PNG, atau WebP.",
      );
    }
    ext = mimeSub === "jpeg" ? "jpg" : mimeSub;
    buffer = Buffer.from(matches[2], "base64");
  } else {
    throw new Error("Format payload gambar tidak valid.");
  }

  // Validasi ukuran maksimal 2MB
  const MAX_SIZE = 2 * 1024 * 1024;
  if (buffer.length > MAX_SIZE) {
    throw new Error("Ukuran foto maksimal 2 MB.");
  }

  // Validasi Magic Bytes header signature gambar
  const isJpeg =
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng =
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47;
  const isWebp =
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50;

  if (!isJpeg && !isPng && !isWebp) {
    throw new Error("File yang diunggah bukan file gambar yang valid.");
  }

  const uploadDir = path.join(__dirname, "../../uploads/avatars");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Nama file unik yang dibuat oleh server
  const filename = `avatar-${userId}-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/avatars/${filename}`;
}

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

    if (req.user.role !== "PENERIMA_BANTUAN") {
      return res.status(403).json({ message: "Hanya penerima bantuan yang dapat membuat pengajuan." });
    }

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

    const result = await prisma.$transaction(async (tx) => {
      // Kunci akun pemohon agar dua permintaan serentak tidak membuat dua pengajuan aktif.
      const users = await tx.$queryRaw`SELECT id FROM \`user\` WHERE id = ${userId} FOR UPDATE`;
      if (users.length === 0) return { missingUser: true };

      const active = await tx.pengajuanBantuan.findFirst({
        where: { userId, status: "MENUNGGU" },
        select: { id: true },
      });
      if (active) return { activeId: active.id };

      const pengajuan = await tx.pengajuanBantuan.create({
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
      return { pengajuan };
    });

    if (result.missingUser) return res.status(404).json({ message: "Akun pemohon tidak ditemukan." });
    if (result.activeId) {
      return res.status(409).json({ message: "Anda masih memiliki pengajuan yang menunggu. Batalkan pengajuan tersebut sebelum membuat pengajuan lain." });
    }

    res.status(201).json({
      message: "Pengajuan bantuan berhasil dikirim! Menunggu verifikasi admin.",
      data: result.pengajuan,
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

// Penerima dapat membatalkan pengajuan sendiri selama belum diputuskan.
exports.batalkanPengajuan = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "ID pengajuan tidak valid." });
    if (req.user.role !== "PENERIMA_BANTUAN") return res.status(403).json({ message: "Hanya pemohon yang dapat membatalkan pengajuan." });

    const changed = await prisma.pengajuanBantuan.updateMany({
      where: { id, userId: req.user.id, status: "MENUNGGU" },
      data: { status: "DIBATALKAN" },
    });
    if (changed.count !== 1) {
      const existing = await prisma.pengajuanBantuan.findUnique({ where: { id }, select: { userId: true, status: true } });
      if (!existing) return res.status(404).json({ message: "Pengajuan tidak ditemukan." });
      if (existing.userId !== req.user.id) return res.status(403).json({ message: "Anda tidak memiliki akses ke pengajuan ini." });
      return res.status(409).json({ message: "Pengajuan yang sudah diproses tidak dapat dibatalkan." });
    }
    const updated = await prisma.pengajuanBantuan.findUnique({ where: { id } });
    return res.status(200).json({ message: "Pengajuan berhasil dibatalkan.", data: updated });
  } catch (error) {
    console.error("Gagal membatalkan pengajuan:", error);
    return res.status(500).json({ message: "Gagal membatalkan pengajuan." });
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

    const applicationId = Number(id);
    if (!Number.isSafeInteger(applicationId) || applicationId <= 0) return res.status(400).json({ message: "ID pengajuan tidak valid." });
    const changed = await prisma.pengajuanBantuan.updateMany({
      where: { id: applicationId, status: "MENUNGGU" },
      data: { status, catatanAdmin: catatanAdmin || null },
    });
    if (changed.count !== 1) {
      const existing = await prisma.pengajuanBantuan.findUnique({ where: { id: applicationId }, select: { status: true } });
      return res.status(existing ? 409 : 404).json({
        message: existing ? `Pengajuan sudah diproses sebelumnya dengan status: ${existing.status}` : "Data pengajuan tidak ditemukan.",
      });
    }
    const updated = await prisma.pengajuanBantuan.findUnique({
      where: { id: applicationId },
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

    if (user) {
      try {
        await prisma.$executeRawUnsafe(
          "ALTER TABLE `user` ADD COLUMN `fotoProfil` TEXT NULL",
        ).catch(() => {});
        const raw = await prisma.$queryRawUnsafe(
          "SELECT fotoProfil FROM `user` WHERE id = ? LIMIT 1",
          userId,
        );
        user.fotoProfil = raw && raw[0] ? raw[0].fotoProfil : null;
      } catch (_) {
        user.fotoProfil = null;
      }
    }

    res.status(200).json({ data: user });
  } catch (error) {
    console.error("Error getProfilSendiri:", error);
    res.status(500).json({
      message: "Gagal mengambil data profil.",
      error: error.message,
    });
  }
};

// 18. Upload dan Perbarui Foto Profil Pengguna
exports.uploadFotoProfil = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fotoProfil } = req.body;

    if (!fotoProfil) {
      return res
        .status(400)
        .json({ message: "Data foto profil tidak ditemukan." });
    }

    // Pastikan kolom fotoProfil ada di tabel user
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `user` ADD COLUMN `fotoProfil` TEXT NULL",
    ).catch(() => {});

    // Ambil data avatar lama untuk dihapus secara bersih
    let oldAvatar = null;
    try {
      const rawOld = await prisma.$queryRawUnsafe(
        "SELECT fotoProfil FROM `user` WHERE id = ? LIMIT 1",
        userId,
      );
      oldAvatar = rawOld && rawOld[0] ? rawOld[0].fotoProfil : null;
    } catch (_) {}

    const newPath = simpanAvatarFile(userId, fotoProfil);

    // Update fotoProfil via Raw SQL (bebas error dari Prisma client cache)
    await prisma.$executeRawUnsafe(
      "UPDATE `user` SET `fotoProfil` = ? WHERE `id` = ?",
      newPath,
      userId,
    );

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nama: true,
        email: true,
        noHp: true,
        alamat: true,
        role: true,
      },
    });

    if (updated) {
      updated.fotoProfil = newPath;
    }

    // Bersihkan file avatar fisik lama jika tersimpan di uploads/avatars/
    if (oldAvatar && oldAvatar.startsWith("/uploads/avatars/")) {
      const oldFilePath = path.join(__dirname, "../../", oldAvatar);
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
        } catch (unlinkErr) {
          console.warn("Gagal menghapus file avatar lama:", unlinkErr.message);
        }
      }
    }

    res.status(200).json({
      message: "Foto profil berhasil diperbarui!",
      data: updated,
    });
  } catch (error) {
    console.error("Error uploadFotoProfil:", error);
    res.status(400).json({
      message: error.message || "Gagal mengunggah foto profil.",
    });
  }
};

// 19. Hapus Foto Profil Pengguna (Reset ke Default)
exports.hapusFotoProfil = async (req, res) => {
  try {
    const userId = req.user.id;

    // Pastikan kolom fotoProfil ada di tabel user
    await prisma.$executeRawUnsafe(
      "ALTER TABLE `user` ADD COLUMN `fotoProfil` TEXT NULL",
    ).catch(() => {});

    let oldAvatar = null;
    try {
      const rawOld = await prisma.$queryRawUnsafe(
        "SELECT fotoProfil FROM `user` WHERE id = ? LIMIT 1",
        userId,
      );
      oldAvatar = rawOld && rawOld[0] ? rawOld[0].fotoProfil : null;
    } catch (_) {}

    if (oldAvatar && oldAvatar.startsWith("/uploads/avatars/")) {
      const filePath = path.join(__dirname, "../../", oldAvatar);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn("Gagal menghapus file avatar:", err.message);
        }
      }
    }

    await prisma.$executeRawUnsafe(
      "UPDATE `user` SET `fotoProfil` = NULL WHERE `id` = ?",
      userId,
    );

    const updated = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nama: true,
        email: true,
        noHp: true,
        alamat: true,
        role: true,
      },
    });

    if (updated) {
      updated.fotoProfil = null;
    }

    res.status(200).json({
      message: "Foto profil berhasil dihapus.",
      data: updated,
    });
  } catch (error) {
    console.error("Error hapusFotoProfil:", error);
    res.status(500).json({
      message: "Gagal menghapus foto profil.",
      error: error.message,
    });
  }
};

// Akhir controller admin & profil
module.exports = exports;
const _unusedGetProfil = async (req, res) => {
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

