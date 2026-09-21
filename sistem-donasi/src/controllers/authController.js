const prisma = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// 1. REGISTRASI (Bisa untuk Donatur atau Penerima Bantuan)
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

    // Simpan User Baru
    const newUser = await prisma.user.create({
      data: {
        nama,
        email,
        password: hashedPassword,
        role: role || "DONATUR",
      },
    });

    // Jika pendaftar adalah PENERIMA_BANTUAN, buatkan data profil penerima bantuan
    if (role === "PENERIMA_BANTUAN") {
      await prisma.penerimaBantuan.create({
        data: {
          userId: newUser.id,
          alamat: alamat || "-",
          noHp: noHp || "-",
          alasan: alasan || "-",
        },
      });
    }

    res.status(201).json({
      message: "Registrasi berhasil!",
      data: {
        id: newUser.id,
        nama: newUser.nama,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. LOGIN (Untuk semua aktor: PENGURUS, DONATUR, PENERIMA_BANTUAN)
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "Email tidak ditemukan!" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Password salah!" });
    }

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
    res.status(500).json({ error: error.message });
  }
};

// 3. LUPA PASSWORD (MODE UJI COBA/DEMO: TANPA SMTP NODEMAILER)
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

    // Buat token sementara yang berlaku 15 menit
    const resetToken = jwt.sign({ id: user.id, email: user.email }, secretKey, {
      expiresIn: "15m",
    });

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // Cetak log di terminal backend
    console.log("==========================================");
    console.log(`[PEMULIHAN PASSWORD] User: ${user.nama} (${user.email})`);
    console.log(`[LINK RESET]: ${resetUrl}`);
    console.log("==========================================");

    // Mengembalikan URL langsung ke frontend
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

// 4. EKSEKUSI RESET PASSWORD BARU DENGAN TOKEN
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

    // Verifikasi Token
    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (err) {
      return res.status(400).json({
        message: "Tautan reset password tidak valid atau telah kadaluwarsa.",
      });
    }

    // Hash password baru & simpan ke database
    const hashedPassword = await bcrypt.hash(passwordBaru, 10);
    await prisma.user.update({
      where: { id: decoded.id },
      data: { password: hashedPassword },
    });

    res.json({
      message: "Password Anda berhasil diperbarui! Silakan login kembali.",
    });
  } catch (error) {
    res.status(500).json({
      message: "Gagal memperbarui password.",
      error: error.message,
    });
  }
};
