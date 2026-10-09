const prisma = require("../db");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const jwt = require("jsonwebtoken");

// ==========================================
// MODUL DONATUR
// ==========================================

// 1. Donatur Mengirim Donasi Online (Publik & Terdaftar)
// BUG FIX: Donasi disimpan dengan status PENDING dulu.
// Saldo program HANYA bertambah saat admin verifikasi donasi menjadi BERHASIL.
exports.createDonasi = async (req, res) => {
  try {
    const { programId, jumlah, metodePembayaran, donaturId } = req.body;

    if (!programId || !jumlah || jumlah <= 0) {
      return res
        .status(400)
        .json({ message: "Program dan nominal donasi valid wajib diisi." });
    }

    const payloadDonasi = {
      programId: parseInt(programId),
      jumlah: parseFloat(jumlah),
      metodePembayaran: metodePembayaran || "QRIS",
      status: "PENDING", // FIX: Selalu PENDING dulu, tidak langsung BERHASIL
    };

    // Ambil donaturId dari token Authorization jika ada
    if (req.headers && req.headers.authorization) {
      try {
        const authHeader = req.headers.authorization;
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.split(" ")[1]
          : authHeader;
        if (token && process.env.JWT_SECRET) {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded && decoded.id) {
            payloadDonasi.donaturId = decoded.id;
          }
        }
      } catch (errJwt) {
        // Token tidak valid/kedaluwarsa, lanjut sebagai donasi publik/anonim
      }
    }

    if (!payloadDonasi.donaturId && req.user && req.user.id) {
      payloadDonasi.donaturId = req.user.id;
    }

    if (!payloadDonasi.donaturId && donaturId) {
      payloadDonasi.donaturId = parseInt(donaturId);
    }

    const donasi = await prisma.donasi.create({
      data: payloadDonasi,
      include: {
        donatur: {
          select: { id: true, nama: true, email: true },
        },
        program: {
          select: { id: true, judul: true },
        },
      },
    });

    res.status(201).json({
      message:
        "Donasi berhasil dicatat! Menunggu verifikasi dari pengurus yayasan.",
      data: donasi,
    });
  } catch (error) {
    console.error("Error createDonasi:", error);
    res.status(500).json({ error: error.message });
  }
};

// 2. Admin Verifikasi Donasi (BERHASIL / GAGAL)
// Saldo program hanya bertambah saat admin set status BERHASIL
exports.verifikasiDonasi = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["BERHASIL", "GAGAL"].includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid! Harus 'BERHASIL' atau 'GAGAL'.",
      });
    }

    const donasi = await prisma.donasi.findUnique({
      where: { id: parseInt(id) },
    });

    if (!donasi) {
      return res.status(404).json({ message: "Data donasi tidak ditemukan." });
    }

    if (donasi.status !== "PENDING") {
      return res.status(400).json({
        message: `Donasi sudah diverifikasi sebelumnya dengan status: ${donasi.status}`,
      });
    }

    // Update status donasi
    const updated = await prisma.donasi.update({
      where: { id: parseInt(id) },
      data: { status },
      include: {
        program: { select: { id: true, judul: true } },
        donatur: { select: { id: true, nama: true } },
      },
    });

    // Jika BERHASIL, baru tambah saldo program
    if (status === "BERHASIL") {
      await prisma.programDonasi.update({
        where: { id: donasi.programId },
        data: { terkumpul: { increment: donasi.jumlah } },
      });
    }

    res.status(200).json({
      message: `Donasi berhasil diverifikasi sebagai ${status}!`,
      data: updated,
    });
  } catch (error) {
    console.error("Error verifikasiDonasi:", error);
    res.status(500).json({ error: error.message });
  }
};

// 3. Ambil Riwayat Donasi Pribadi Donatur Login
exports.getRiwayatDonatur = async (req, res) => {
  try {
    const donaturId = req.user.id;

    const riwayat = await prisma.donasi.findMany({
      where: { donaturId },
      include: {
        program: {
          select: { judul: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ data: riwayat });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Rekap Transparansi Dana (Publik / Donatur) - hanya hitung yang BERHASIL
exports.getLaporanTransparansi = async (req, res) => {
  try {
    const totalDonasi = await prisma.donasi.aggregate({
      where: { status: "BERHASIL" },
      _sum: { jumlah: true },
    });

    const totalPenyaluran = await prisma.penyaluranBantuan.aggregate({
      _sum: { jumlahBantuan: true },
    });

    res.status(200).json({
      totalTerhimpun: totalDonasi._sum.jumlah || 0,
      totalTersalurkan: totalPenyaluran._sum.jumlahBantuan || 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// MODUL PENGURUS (ADMIN) & REPORTING
// ==========================================

// 5. Pengurus Menyalurkan Bantuan ke Penerima
exports.createPenyaluran = async (req, res) => {
  try {
    const { programId, penerimaId, jumlah, jumlahBantuan, keterangan } =
      req.body;

    const nominalBantuan = parseFloat(jumlahBantuan || jumlah);

    if (!programId || !penerimaId || !nominalBantuan) {
      return res.status(400).json({
        message: "Program, Penerima Bantuan, dan Nominal Wajib diisi!",
      });
    }

    let validPenerimaId = parseInt(penerimaId);
    const profilPenerima = await prisma.penerimaBantuan.findFirst({
      where: {
        OR: [{ id: validPenerimaId }, { userId: validPenerimaId }],
      },
    });

    if (profilPenerima) {
      validPenerimaId = profilPenerima.id;
    }

    const penyaluran = await prisma.penyaluranBantuan.create({
      data: {
        programId: parseInt(programId),
        penerimaId: validPenerimaId,
        jumlahBantuan: nominalBantuan,
        keterangan: keterangan || "Penyaluran Bantuan",
      },
    });

    res.status(201).json({
      message: "Penyaluran bantuan berhasil dicatat!",
      data: penyaluran,
    });
  } catch (error) {
    console.error("Error createPenyaluran:", error);
    res.status(500).json({ error: error.message });
  }
};

// 6. Export Laporan Program ke PDF
exports.exportPDF = async (req, res) => {
  try {
    const penyaluranList = await prisma.penyaluranBantuan.findMany({
      include: {
        program: true,
        penerima: { include: { user: true } },
      },
      orderBy: { id: "desc" },
    });

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=laporan-penyaluran.pdf",
    );

    doc.pipe(res);

    doc
      .fontSize(16)
      .text("LAPORAN PENYALURAN BANTUAN YAYASAN MULIA KARYA BERSAMA", {
        align: "center",
      });
    doc.moveDown();
    doc
      .fontSize(10)
      .text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`);
    doc.moveDown();

    if (penyaluranList.length === 0) {
      doc.fontSize(10).text("Belum ada data penyaluran bantuan.");
    } else {
      penyaluranList.forEach((item, index) => {
        const namaProgram = item.program?.judul || "Program Donasi";
        const namaPenerima = item.penerima?.user?.nama || "Penerima Bantuan";
        const nominal = (item.jumlahBantuan || 0).toLocaleString("id-ID");

        doc
          .fontSize(10)
          .text(
            `${index + 1}. Program: ${namaProgram} | Penerima: ${namaPenerima} | Bantuan: Rp ${nominal}`,
          );
      });
    }

    doc.end();
  } catch (error) {
    console.error("Error exportPDF:", error);
    res.status(500).json({ error: error.message });
  }
};

// 7. Export Laporan ke Excel
exports.exportExcel = async (req, res) => {
  try {
    const penyaluranList = await prisma.penyaluranBantuan.findMany({
      include: {
        program: true,
        penerima: { include: { user: true } },
      },
      orderBy: { id: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Penyaluran Bantuan");

    worksheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "Nama Program", key: "program", width: 25 },
      { header: "Nama Penerima", key: "penerima", width: 20 },
      { header: "Jumlah Bantuan (Rp)", key: "jumlah", width: 20 },
      { header: "Keterangan", key: "keterangan", width: 30 },
      { header: "Tanggal Salur", key: "tanggal", width: 15 },
    ];

    penyaluranList.forEach((item, index) => {
      const tgl = item.tanggalSalur || item.createdAt || new Date();
      const formattedDate = new Date(tgl).toISOString().split("T")[0];

      worksheet.addRow({
        no: index + 1,
        program: item.program?.judul || "-",
        penerima: item.penerima?.user?.nama || "-",
        jumlah: item.jumlahBantuan || 0,
        keterangan: item.keterangan || "-",
        tanggal: formattedDate,
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=laporan-penyaluran.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exportExcel:", error);
    res.status(500).json({ error: error.message });
  }
};

// 8. Ambil Semua Transaksi Donasi Masuk (Khusus Admin)
exports.getAllDonasi = async (req, res) => {
  try {
    const listDonasi = await prisma.donasi.findMany({
      include: {
        donatur: {
          select: {
            id: true,
            nama: true,
            email: true,
            role: true,
          },
        },
        program: {
          select: {
            id: true,
            judul: true,
            targetDana: true,
            terkumpul: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: listDonasi,
    });
  } catch (error) {
    console.error("Error getAllDonasi:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
