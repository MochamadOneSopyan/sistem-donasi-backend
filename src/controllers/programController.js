const prisma = require("../db");

// Ambil semua daftar program donasi (Publik)
exports.getAllProgram = async (req, res) => {
  try {
    const programs = await prisma.programDonasi.findMany({
      include: {
        donasi: {
          include: {
            donatur: {
              select: { id: true, nama: true, email: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
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

// Hapus program donasi (Khusus PENGURUS)
exports.deleteProgram = async (req, res) => {
  try {
    const { id } = req.params;
    const programId = parseInt(id);

    // Hapus relasi donasi dan penyaluran terkait
    await prisma.donasi.deleteMany({ where: { programId } });
    await prisma.penyaluranBantuan.deleteMany({ where: { programId } });
    await prisma.programDonasi.delete({ where: { id: programId } });

    res.json({ message: "Program donasi berhasil dihapus!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
