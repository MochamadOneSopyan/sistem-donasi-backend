const prisma = require("../db");

// Ambil semua daftar program donasi (Publik)
exports.getAllProgram = async (req, res) => {
  try {
    const programs = await prisma.programDonasi.findMany({
      include: {
        donasi: true,
        penyaluranBantuan: true,
      },
    });
    res.json({ status: "success", data: programs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Tambah program donasi baru (Khusus PENGURUS)
exports.createProgram = async (req, res) => {
  try {
    const { judul, deskripsi, targetDana } = req.body;

    const newProgram = await prisma.programDonasi.create({
      data: {
        judul,
        deskripsi,
        targetDana: parseFloat(targetDana),
      },
    });

    res.status(201).json({
      message: "Program donasi berhasil dibuat!",
      data: newProgram,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
