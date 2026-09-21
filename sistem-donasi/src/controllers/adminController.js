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

    // Cek apakah email sudah terdaftar
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Email sudah digunakan oleh pengguna lain!" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Buat user dengan role PENGURUS
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

// 2. MENGAMBIL DAFTAR PENGURUS (Daftar Pengurus Yayasan)
exports.getDaftarPengurus = async (req, res) => {
  try {
    const pengurus = await prisma.user.findMany({
      where: { role: "PENGURUS" },
      select: {
        id: true,
        nama: true,
        email: true,
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

// 3. RESET PASSWORD PENGURUS LAIN OLEH ADMIN
exports.resetPasswordPengurus = async (req, res) => {
  try {
    const { id } = req.params;
    const { passwordBaru } = req.body;

    if (!passwordBaru || passwordBaru.length < 6) {
      return res.status(400).json({
        message: "Password baru minimal 6 karakter.",
      });
    }

    // Pastikan user yang dituju adalah PENGURUS
    const targetUser = await prisma.user.findUnique({
      where: { id: Number(id) },
    });

    if (!targetUser || targetUser.role !== "PENGURUS") {
      return res.status(404).json({
        message: "Pengurus tidak ditemukan.",
      });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(passwordBaru, 10);

    // Update password di database
    await prisma.user.update({
      where: { id: Number(id) },
      data: { password: hashedPassword },
    });

    res.json({
      message: `Password untuk ${targetUser.nama} berhasil diperbarui!`,
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal mereset password pengurus.",
      error: error.message,
    });
  }
};
