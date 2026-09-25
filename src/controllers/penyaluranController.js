const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Catat Penyaluran Bantuan Baru
exports.tambahPenyaluran = async (req, res) => {
  try {
    const { programId, penerimaId, jumlah, keterangan } = req.body;

    const penyaluranBaru = await prisma.penyaluran.create({
      data: {
        programId,
        penerimaId,
        jumlah: parseFloat(jumlah),
        keterangan,
      },
    });

    res.status(201).json({
      success: true,
      message: "Penyaluran bantuan berhasil dicatat!",
      data: penyaluranBaru,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
