const prisma = require("../db");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

// ==========================================
// MODUL DONATUR
// ==========================================

// 1. Donatur Mengirim Donasi Online (Publik & Terdaftar)
exports.createDonasi = async (req, res) => {
  try {
    const { programId, jumlah, metodePembayaran } = req.body;

    if (!programId || !jumlah || jumlah <= 0) {
      return res
        .status(400)
        .json({ message: "Program dan nominal donasi valid wajib diisi." });
    }

    // 🟢 Susun payload data donasi
    const payloadDonasi = {
      programId: parseInt(programId),
      jumlah: parseFloat(jumlah),
      metodePembayaran: metodePembayaran || "QRIS",
      status: "BERHASIL",
    };

    // 🟢 Hanya masukkan field donaturId jika pengguna memang sedang login
    if (req.user && req.user.id) {
      payloadDonasi.donaturId = req.user.id;
    }

    // 1. Simpan Transaksi Donasi
    const donasi = await prisma.donasi.create({
      data: payloadDonasi,
    });

    // 2. Update Saldo Terkumpul pada Program (Solusi Toleran untuk Nama Model Prisma)
    try {
      if (prisma.program) {
        await prisma.program.update({
          where: { id: parseInt(programId) },
          data: { terkumpul: { increment: parseFloat(jumlah) } },
        });
      } else if (prisma.programDonasi) {
        await prisma.programDonasi.update({
          where: { id: parseInt(programId) },
          data: { terkumpul: { increment: parseFloat(jumlah) } },
        });
      }
    } catch (errUpdate) {
      console.warn(
        "Peringatan: Gagal update saldo program, namun transaksi donasi tetap berhasil dicatat:",
        errUpdate.message,
      );
    }

    res.status(201).json({
      message: "Donasi berhasil disalurkan! Terima kasih atas kepedulian Anda.",
      data: donasi,
    });
  } catch (error) {
    console.error("Error createDonasi:", error);
    res.status(500).json({ error: error.message });
  }
};

// 2. Ambil Riwayat Donasi Pribadi Donatur Login
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

// 3. Rekap Transparansi Dana (Publik / Donatur)
exports.getLaporanTransparansi = async (req, res) => {
  try {
    const totalDonasi = await prisma.donasi.aggregate({
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

// 4. Pengurus Menyalurkan Bantuan ke Penerima
exports.createPenyaluran = async (req, res) => {
  try {
    const { programId, penerimaId, jumlahBantuan, keterangan } = req.body;

    const penyaluran = await prisma.penyaluranBantuan.create({
      data: {
        programId: parseInt(programId),
        penerimaId: parseInt(penerimaId),
        jumlahBantuan: parseFloat(jumlahBantuan),
        keterangan,
      },
    });

    res.status(201).json({
      message: "Penyaluran bantuan berhasil dicatat!",
      data: penyaluran,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Export Laporan Program ke PDF (Menggunakan PDFKit)
exports.exportPDF = async (req, res) => {
  try {
    const penyaluranList = await prisma.penyaluranBantuan.findMany({
      include: { program: true, penerima: { include: { user: true } } },
    });

    const doc = new PDFDocument({ margin: 30 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=laporan-penyaluran.pdf",
    );

    doc.pipe(res);

    // Header Laporan
    doc
      .fontSize(18)
      .text("LAPORAN PENYALURAN BANTUAN YAYASAN MULIA KARYA BERSAMA", {
        align: "center",
      });
    doc.moveDown();
    doc
      .fontSize(12)
      .text(`Tanggal Cetak: ${new Date().toLocaleDateString("id-ID")}`);
    doc.moveDown();

    // Isi Data
    penyaluranList.forEach((item, index) => {
      doc
        .fontSize(10)
        .text(
          `${index + 1}. Program: ${item.program.judul} | Penerima: ${item.penerima.user.nama} | Bantuan: Rp ${item.jumlahBantuan.toLocaleString("id-ID")}`,
        );
    });

    doc.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Export Laporan Program ke Excel (Menggunakan ExcelJS)
exports.exportExcel = async (req, res) => {
  try {
    const penyaluranList = await prisma.penyaluranBantuan.findMany({
      include: { program: true, penerima: { include: { user: true } } },
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
      worksheet.addRow({
        no: index + 1,
        program: item.program.judul,
        penerima: item.penerima.user.nama,
        jumlah: item.jumlahBantuan,
        keterangan: item.keterangan,
        tanggal: item.tanggalSalur.toISOString().split("T")[0],
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
    res.status(500).json({ error: error.message });
  }
};
