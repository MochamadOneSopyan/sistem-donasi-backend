const prisma = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 1. REGISTRASI
exports.register = async (req, res) => {
  try {
    const { nama, email, password, role, alamat, noHp, alasan } = req.body;

    // Cek apakah email sudah pernah terdaftar
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: "Email sudah terdaftar!" });
    }

    // Hash password menggunakan bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Tentukan Role (Default: DONATUR)
    const userRole = role || "DONATUR";

    // Opsi data pendaftaran dasar
    let createData = {
      nama,
      email,
      password: hashedPassword,
      role: userRole,
    };

    // Jika PENERIMA_BANTUAN, buat sekaligus menggunakan Nested Write Prisma
    if (userRole === "PENERIMA_BANTUAN") {
      createData.penerimaBantuan = {
        create: {
          alamat: alamat || "-",
          noHp: noHp || "-",
          alasan: alasan || "-",
          status: "VERIFIKASI", // Sesuai enum StatusPenerima di schema.prisma
        },
      };
    }

    // Simpan data User
    const newUser = await prisma.user.create({
      data: createData,
    });

    res.status(201).json({
      message:
        userRole === "PENERIMA_BANTUAN"
          ? "Registrasi berhasil! Akun Anda sedang dalam proses verifikasi oleh Admin."
          : "Registrasi berhasil!",
      data: {
        id: newUser.id,
        nama: newUser.nama,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    console.error("Error Register:", error);
    res.status(500).json({
      message: "Gagal melakukan pendaftaran.",
      error: error.message,
    });
  }
};

// 2. LOGIN (Urutan Pengecekan Ditolak Diperbaiki)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        penerimaBantuan: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Email tidak ditemukan!" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Password salah!" });
    }

    // 🔴 PROTEKSI & PERBAIKAN: Cek Verifikasi khusus PENERIMA_BANTUAN
    if (user.role === "PENERIMA_BANTUAN") {
      const profilPenerima = Array.isArray(user.penerimaBantuan)
        ? user.penerimaBantuan[0]
        : user.penerimaBantuan;

      // 🟢 1. Cek terlebih dahulu apakah pendaftaran DITOLAK
      if (profilPenerima && profilPenerima.status === "DITOLAK") {
        return res.status(403).json({
          message:
            "Mohon maaf, pendaftaran akun Penerima Bantuan Anda tidak disetujui oleh Admin.",
        });
      }

      // 🟢 2. Cek jika profil belum ada atau statusnya masih VERIFIKASI (Menunggu)
      if (!profilPenerima || profilPenerima.status === "VERIFIKASI") {
        return res.status(403).json({
          message:
            "Akun Penerima Bantuan Anda belum disetujui/diverifikasi oleh Admin. Silakan tunggu konfirmasi Admin.",
        });
      }

      // Jika status "DISETUJUI", proses login akan berlanjut ke bawah.
    }

    // Pembuatan Token JWT
    const secretKey =
      process.env.JWT_SECRET || "kunci_rahasia_skripsi_yayasan_2026";

    const token = jwt.sign(
      { id: user.id, role: user.role, nama: user.nama },
      secretKey,
      { expiresIn: "1d" },
    );

    res.json({
      message: "Login berhasil!",
      token,
      user: {
        id: user.id,
        nama: user.nama,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Error Login:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan saat login.", error: error.message });
  }
};

// 3. LUPA PASSWORD
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Alamat email wajib diisi." });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Alamat email tidak terdaftar di sistem kami." });
    }

    const secretKey =
      process.env.JWT_SECRET || "kunci_rahasia_skripsi_yayasan_2026";

    const resetToken = jwt.sign({ id: user.id, email: user.email }, secretKey, {
      expiresIn: "15m",
    });

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    console.log("==========================================");
    console.log(`[PEMULIHAN PASSWORD] User: ${user.nama} (${user.email})`);
    console.log(`[LINK RESET]: ${resetUrl}`);
    console.log("==========================================");

    res.json({
      message: "Tautan pemulihan password berhasil dibuat!",
      resetUrl,
    });
  } catch (error) {
    console.error("Error Forgot Password:", error);
    res.status(500).json({
      message: "Gagal memproses permintaan reset password.",
      error: error.message,
    });
  }
};

// 4. EKSEKUSI RESET PASSWORD BARU
exports.resetPasswordWithToken = async (req, res) => {
  try {
    const { token, passwordBaru } = req.body;

    if (!token || !passwordBaru) {
      return res
        .status(400)
        .json({ message: "Token dan password baru wajib diisi." });
    }

    if (passwordBaru.length < 6) {
      return res
        .status(400)
        .json({ message: "Password baru minimal 6 karakter." });
    }

    const secretKey =
      process.env.JWT_SECRET || "kunci_rahasia_skripsi_yayasan_2026";

    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (err) {
      return res.status(400).json({
        message: "Tautan reset password tidak valid atau telah kadaluwarsa.",
      });
    }

    const hashedPassword = await bcrypt.hash(passwordBaru, 10);
    await prisma.user.update({
      where: { id: decoded.id },
      data: { password: hashedPassword },
    });

    res.json({
      message: "Password Anda berhasil diperbarui! Silakan login kembali.",
    });
  } catch (error) {
    console.error("Error Reset Password:", error);
    res.status(500).json({
      message: "Gagal memperbarui password.",
      error: error.message,
    });
  }
};
