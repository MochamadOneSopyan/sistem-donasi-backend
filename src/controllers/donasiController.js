const prisma = require("../db");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const jwt = require("jsonwebtoken");

// ==========================================
// MODUL DONATUR
// ==========================================

// 1. Donatur Mengirim Donasi Online (Publik & Terdaftar)
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
      status: "BERHASIL",
    };

    // 1. Ambil donaturId dari token Authorization jika ada
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

    // 2. Jika belum ada dari token, gunakan dari req.user jika diset middleware
    if (!payloadDonasi.donaturId && req.user && req.user.id) {
      payloadDonasi.donaturId = req.user.id;
    }

    // 3. Jika dikirim dari body
    if (!payloadDonasi.donaturId && donaturId) {
      payloadDonasi.donaturId = parseInt(donaturId);
    }

    // 1. Simpan Transaksi Donasi
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

    // 2. Update Saldo Terkumpul pada Program
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
    const { programId, penerimaId, jumlah, jumlahBantuan, keterangan } =
      req.body;

    const nominalBantuan = parseFloat(jumlahBantuan || jumlah);

    if (!programId || !penerimaId || !nominalBantuan) {
      return res.status(400).json({
        message: "Program, Penerima Bantuan, dan Nominal Wajib diisi!",
      });
    }

    // Pengecekan ID Penerima (Apakah ID Tabel PenerimaBantuan atau ID User)
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

// 5. Export Laporan Program ke PDF (Menggunakan PDFKit)
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

    // Header Laporan
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

    // Isi Data
    if (penyaluranList.length === 0) {
      doc.fontSize(10).text("Belum ada data penyaluran bantuan.");
    } else {
      penyaluranList.forEach((item, index) => {
        const namaProgram =
          item.program?.judul || item.program?.namaProgram || "Program Donasi";
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

// 6. Export Laporan Program ke Excel (Menggunakan ExcelJS)
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
        program: item.program?.judul || item.program?.namaProgram || "-",
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

// 7. Ambil Semua Transaksi Donasi Masuk (Khusus Pengurus / Admin)
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
