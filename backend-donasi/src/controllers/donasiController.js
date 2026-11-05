const prisma = require("../db");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { getUploadsDir, getUploadFilePath } = require("../uploadPaths");
const { getSixMonthStart, summarizeSixMonths } = require("../utils/donationTrend");
const { can } = require("../roles");

const donationInclude = {
  donatur: { select: { id: true, nama: true, email: true } },
  program: { select: { id: true, judul: true } },
};

function proofTokenFor(donationId) {
  return jwt.sign({ purpose: "donation-proof", donationId }, process.env.JWT_SECRET, { expiresIn: "24h" });
}

function donationResponse(res, donation, statusCode = 201) {
  return res.status(statusCode).json({
    message: statusCode === 200 ? "Permintaan donasi ini sudah tercatat." : "Donasi berhasil dicatat! Menunggu verifikasi dari pengurus yayasan.",
    data: donation,
    proofToken: proofTokenFor(donation.id),
  });
}

// Helper simpan file bukti dari base64 ke folder uploads/bukti
function simpanFileBukti(dataUrl) {
  try {
    if (!dataUrl || typeof dataUrl !== "string") return null;
    const matches = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
    if (!matches) return null;
    const ext = matches[1] === "jpeg" ? "jpg" : matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    if (!buffer.length || buffer.length > 10 * 1024 * 1024) return null;

    const uploadDir = path.join(getUploadsDir(), "bukti");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `bukti-${Date.now()}-${Math.floor(Math.random() * 10000)}.${ext}`;
    fs.writeFileSync(path.join(uploadDir, filename), buffer);

    return `/uploads/bukti/${filename}`;
  } catch (err) {
    console.error("Gagal menyimpan file bukti:", err);
    return null;
  }
}

// ==========================================
// MODUL DONATUR
// ==========================================

// 1. Donatur Mengirim Donasi Online (Publik & Terdaftar)
// BUG FIX: Donasi disimpan dengan status PENDING dulu.
// Saldo program HANYA bertambah saat admin verifikasi donasi menjadi BERHASIL.
exports.createDonasi = async (req, res) => {
  try {
    const { programId, jumlah, metodePembayaran, requestId } = req.body;
    const validProgramId = Number(programId);
    const validAmount = Number(jumlah);

    if (!Number.isSafeInteger(validProgramId) || validProgramId <= 0 || !Number.isSafeInteger(validAmount) || validAmount < 10000 || validAmount > 1000000000) {
      return res
        .status(400)
        .json({ message: "Program dan nominal donasi bulat antara Rp 10.000 dan Rp 1.000.000.000 wajib diisi." });
    }
    if (requestId !== undefined && (typeof requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))) {
      return res.status(400).json({ message: "ID permintaan donasi tidak valid." });
    }
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: "Konfigurasi server belum siap untuk menerima donasi." });
    }

    if (requestId) {
      const existing = await prisma.donasi.findUnique({ where: { requestId }, include: donationInclude });
      if (existing) {
        if (existing.programId !== validProgramId || Number(existing.jumlah) !== validAmount) {
          return res.status(409).json({ message: "ID permintaan sudah digunakan untuk donasi berbeda." });
        }
        return donationResponse(res, existing, 200);
      }
    }

    const payloadDonasi = {
      programId: validProgramId,
      jumlah: validAmount,
      metodePembayaran: metodePembayaran || "QRIS",
      status: "PENDING",
      ...(requestId ? { requestId } : {}),
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

    if (req.body.buktiPembayaran) {
      const savedPath = simpanFileBukti(req.body.buktiPembayaran);
      if (savedPath) {
        payloadDonasi.buktiPembayaran = savedPath;
      }
    }

    const donasi = await prisma.donasi.create({
      data: payloadDonasi,
      include: donationInclude,
    });

    return donationResponse(res, donasi);
  } catch (error) {
    if (error.code === "P2002" && req.body?.requestId) {
      const existing = await prisma.donasi.findUnique({ where: { requestId: req.body.requestId }, include: donationInclude });
      if (existing && existing.programId === Number(req.body.programId) && Number(existing.jumlah) === Number(req.body.jumlah)) {
        return donationResponse(res, existing, 200);
      }
      return res.status(409).json({ message: "ID permintaan sudah digunakan untuk donasi berbeda." });
    }
    console.error("Error createDonasi:", error);
    res.status(500).json({ error: error.message });
  }
};

// 1b. Donatur / Admin Mengunggah Bukti Pembayaran untuk Donasi yang Sudah Ada
exports.uploadBuktiDonasi = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { buktiPembayaran } = req.body;

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID donasi tidak valid." });
    }

    if (!buktiPembayaran) {
      return res
        .status(400)
        .json({ message: "Data bukti pembayaran wajib diisi." });
    }

    const donasi = await prisma.donasi.findUnique({
      where: { id },
    });

    if (!donasi) {
      return res.status(404).json({ message: "Data donasi tidak ditemukan." });
    }

    let authorized = false;
    let isAdmin = false;
    try {
      const proofToken = req.headers["x-donation-proof-token"];
      if (proofToken) {
        const proof = jwt.verify(proofToken, process.env.JWT_SECRET);
        authorized = proof.purpose === "donation-proof" && proof.donationId === id;
      }
    } catch { /* Invalid proof token; a valid account token may still authorize. */ }
    try {
      const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, "");
      if (bearer) {
        const account = jwt.verify(bearer, process.env.JWT_SECRET);
        isAdmin = can(account.role, "VERIFIKASI_DONASI");
        authorized ||= isAdmin || (donasi.donaturId != null && account.id === donasi.donaturId);
      }
    } catch { /* Invalid account token. */ }
    if (!authorized) {
      return res.status(403).json({ message: "Anda tidak memiliki akses untuk mengunggah bukti donasi ini." });
    }
    if (donasi.status !== "PENDING" && !isAdmin) {
      return res.status(409).json({ message: "Bukti donasi yang sudah diverifikasi tidak dapat diubah." });
    }

    const savedPath = simpanFileBukti(buktiPembayaran);
    if (!savedPath) {
      return res
        .status(400)
        .json({ message: "Gagal memproses file gambar bukti pembayaran." });
    }

    const updated = await prisma.donasi.update({
      where: { id },
      data: { buktiPembayaran: savedPath },
      include: {
        donatur: { select: { id: true, nama: true, email: true } },
        program: { select: { id: true, judul: true } },
      },
    });

    res.status(200).json({
      message: "Bukti pembayaran berhasil disimpan ke database yayasan!",
      data: updated,
    });
  } catch (error) {
    console.error("Error uploadBuktiDonasi:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getBuktiDonasi = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "ID donasi tidak valid." });
    const donation = await prisma.donasi.findUnique({ where: { id }, select: { donaturId: true, buktiPembayaran: true } });
    if (!donation) return res.status(404).json({ message: "Donasi tidak ditemukan." });
    if (!can(req.user.role, "LIHAT_DONASI") && (donation.donaturId == null || donation.donaturId !== req.user.id)) {
      return res.status(403).json({ message: "Anda tidak memiliki akses ke bukti ini." });
    }
    const file = donation.buktiPembayaran;
    if (!file || !/^\/uploads\/bukti\/bukti-[a-zA-Z0-9._-]+\.(jpg|png|webp)$/.test(file)) {
      return res.status(404).json({ message: "Bukti pembayaran tidak tersedia." });
    }
    res.set("Cache-Control", "private, no-store");
    return res.sendFile(getUploadFilePath("bukti", path.basename(file)));
  } catch (error) {
    console.error("Error getBuktiDonasi:", error);
    return res.status(500).json({ message: "Gagal memuat bukti pembayaran." });
  }
};

exports.deleteBuktiDonasi = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ message: "ID donasi tidak valid." });
    const donation = await prisma.donasi.findUnique({ where: { id }, select: { buktiPembayaran: true } });
    if (!donation) return res.status(404).json({ message: "Donasi tidak ditemukan." });
    await prisma.donasi.update({ where: { id }, data: { buktiPembayaran: null } });
    const file = donation.buktiPembayaran;
    if (file && /^\/uploads\/bukti\/bukti-[a-zA-Z0-9._-]+\.(jpg|png|webp)$/.test(file)) {
      fs.promises.unlink(getUploadFilePath("bukti", path.basename(file))).catch((error) => {
        if (error.code !== "ENOENT") console.error("Gagal menghapus berkas bukti:", error);
      });
    }
    return res.status(200).json({ message: "Bukti pembayaran berhasil dihapus." });
  } catch (error) {
    console.error("Error deleteBuktiDonasi:", error);
    return res.status(500).json({ message: "Gagal menghapus bukti pembayaran." });
  }
};

// 2. Admin Verifikasi Donasi (BERHASIL / GAGAL)
// Saldo program hanya bertambah saat admin set status BERHASIL
exports.verifikasiDonasi = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!Number.isSafeInteger(id) || id <= 0) {
      return res.status(400).json({ message: "ID donasi tidak valid." });
    }

    if (!["BERHASIL", "GAGAL"].includes(status)) {
      return res.status(400).json({
        message: "Status tidak valid! Harus 'BERHASIL' atau 'GAGAL'.",
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.donasi.updateMany({ where: { id, status: "PENDING" }, data: { status } });
      if (changed.count !== 1) return null;
      const donation = await tx.donasi.findUnique({
        where: { id },
        include: { program: { select: { id: true, judul: true } }, donatur: { select: { id: true, nama: true } } },
      });
      if (status === "BERHASIL") {
        await tx.programDonasi.update({
          where: { id: donation.programId },
          data: { terkumpul: { increment: donation.jumlah } },
        });
      }
      return donation;
    });

    if (!updated) {
      const existing = await prisma.donasi.findUnique({ where: { id }, select: { status: true } });
      return res.status(existing ? 409 : 404).json({
        message: existing ? `Donasi sudah diproses sebelumnya dengan status: ${existing.status}` : "Data donasi tidak ditemukan.",
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

// 4. Rekap Transparansi Dana (Publik / Donatur / Masyarakat)
exports.getLaporanTransparansi = async (req, res) => {
  try {
    const reportTime = new Date();
    const totalDonasi = await prisma.donasi.aggregate({
      where: { status: "BERHASIL" },
      _sum: { jumlah: true },
      _count: { id: true },
    });

    const totalPenyaluran = await prisma.penyaluranBantuan.aggregate({
      _sum: { jumlahBantuan: true },
      _count: { id: true },
    });

    const totalTerhimpun = totalDonasi._sum.jumlah || 0;
    const totalTersalurkan = totalPenyaluran._sum.jumlahBantuan || 0;
    const sisaSaldo = totalTerhimpun - totalTersalurkan;

    // Hanya transaksi yang sudah diverifikasi; bulan mengikuti waktu Jakarta.
    const firstMonth = getSixMonthStart(reportTime);
    const [donasiEnamBulan, penyaluranEnamBulan] = await Promise.all([
      prisma.donasi.findMany({
        where: { status: "BERHASIL", createdAt: { gte: firstMonth, lte: reportTime } },
        select: { jumlah: true, createdAt: true },
      }),
      prisma.penyaluranBantuan.findMany({
        where: { tanggalSalur: { gte: firstMonth, lte: reportTime } },
        select: { jumlahBantuan: true, tanggalSalur: true },
      }),
    ]);
    const trenDonasi = summarizeSixMonths(donasiEnamBulan, reportTime, penyaluranEnamBulan);

    // Ambil daftar penyaluran terbaru untuk transparansi publik
    const penyaluranTerbaru = await prisma.penyaluranBantuan.findMany({
      take: 8,
      orderBy: { tanggalSalur: "desc" },
      select: {
        id: true,
        jumlahBantuan: true,
        tanggalSalur: true,
        program: { select: { id: true, judul: true } },
      },
    });

    // Ambil program dengan kalkulasi dana tersalurkan
    const programs = await prisma.programDonasi.findMany({
      include: {
        donasi: {
          where: { status: "BERHASIL" },
          select: { jumlah: true },
        },
        penyaluranBantuan: {
          select: { jumlahBantuan: true, tanggalSalur: true },
        },
      },
      orderBy: { id: "asc" },
    });

    const programRealisasi = programs.map((p) => {
      const terkumpul = p.donasi.reduce(
        (a, b) => a + Number(b.jumlah || 0),
        0,
      );
      const tersalurkan = p.penyaluranBantuan.reduce(
        (a, b) => a + Number(b.jumlahBantuan || 0),
        0,
      );
      return {
        id: p.id,
        judul: p.judul,
        deskripsi: p.deskripsi,
        imageUrl: p.imageUrl,
        targetDana: p.targetDana,
        terkumpul,
        tersalurkan,
        persenTersalurkan:
          terkumpul > 0
            ? Math.min(100, Math.round((tersalurkan / terkumpul) * 100))
            : 0,
        jumlahPenyaluran: p.penyaluranBantuan.length,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        totalTerhimpun,
        totalTersalurkan,
        sisaSaldo,
        totalTransaksiBerhasil: totalDonasi._count.id || 0,
        totalPenyaluranCount: totalPenyaluran._count.id || 0,
        laporanDibuatPada: reportTime.toISOString(),
        trenDonasi,
        penyaluranTerbaru,
        programRealisasi,
      },
      // Backward compatibility jika ada kode lama yang membaca root
      totalTerhimpun,
      totalTersalurkan,
    });
  } catch (error) {
    console.error("Error getLaporanTransparansi:", error);
    res.status(500).json({ success: false, error: error.message });
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

// 5b. Ambil Riwayat Penyaluran Pribadi Penerima Bantuan
exports.getPenyaluranSaya = async (req, res) => {
  try {
    const userId = req.user.id;
    const profilPenerima = await prisma.penerimaBantuan.findFirst({
      where: { userId },
    });

    if (!profilPenerima) {
      return res.status(200).json({ data: [] });
    }

    const riwayat = await prisma.penyaluranBantuan.findMany({
      where: { penerimaId: profilPenerima.id },
      include: {
        program: {
          select: { id: true, judul: true },
        },
      },
      orderBy: { tanggalSalur: "desc" },
    });

    res.status(200).json({ data: riwayat });
  } catch (error) {
    console.error("Error getPenyaluranSaya:", error);
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
