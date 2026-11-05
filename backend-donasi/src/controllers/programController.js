const prisma = require("../db");
const jwt = require("jsonwebtoken");
const { isStaff } = require("../roles");
const { uploadProgramImage, deleteProgramImage, isManagedProgramImage, assertProgramImageStorageReady } = require("../services/programImageStorage");

function programId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function programFields(body, requireAll = false) {
  const fields = {};
  for (const name of ["judul", "deskripsi"]) {
    if (body[name] === undefined && !requireAll) continue;
    const value = typeof body[name] === "string" ? body[name].trim() : "";
    if (!value) throw Object.assign(new Error(`${name === "judul" ? "Judul" : "Deskripsi"} program wajib diisi.`), { status: 400 });
    fields[name] = value;
  }
  if (body.targetDana !== undefined || requireAll) {
    const value = Number(body.targetDana);
    if (!Number.isFinite(value) || value <= 0) throw Object.assign(new Error("Target dana harus lebih dari 0."), { status: 400 });
    fields.targetDana = value;
  }
  return fields;
}

async function cleanupImage(publicId) {
  if (!publicId) return false;
  try {
    await deleteProgramImage(publicId);
    return false;
  } catch (error) {
    console.error("Gagal membersihkan gambar program lama:", error);
    return true;
  }
}

function sendError(res, error, fallback) {
  if (error.status) return res.status(error.status).json({ message: error.message });
  console.error(fallback, error);
  return res.status(500).json({ message: fallback });
}

// Publik hanya menerima nilai agregat dan catatan penyaluran tanpa identitas.
// Panel pengurus tetap menerima relasi lengkap setelah token diverifikasi.
exports.getAllProgram = async (req, res) => {
  try {
    let admin = false;
    try {
      const token = req.headers?.authorization?.replace(/^Bearer\s+/i, "");
      if (token && process.env.JWT_SECRET) admin = isStaff(jwt.verify(token, process.env.JWT_SECRET).role);
    } catch { /* Token tidak valid: gunakan data publik. */ }
    const programs = await prisma.programDonasi.findMany({
      ...(admin ? { include: {
        donasi: { select: { id: true, jumlah: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" } },
        penyaluranBantuan: true,
      } } : { select: {
        id: true, judul: true, deskripsi: true, imageUrl: true,
        targetDana: true, terkumpul: true, createdAt: true,
        donasi: { where: { status: "BERHASIL" }, select: { jumlah: true, status: true } },
        penyaluranBantuan: { select: { id: true, jumlahBantuan: true, tanggalSalur: true } },
      } }),
      orderBy: { createdAt: "desc" },
    });
    res.json({ status: "success", data: programs });
  } catch (error) {
    sendError(res, error, "Gagal memuat program donasi.");
  }
};

exports.createProgram = async (req, res) => {
  let uploadedImage = null;
  try {
    const fields = programFields(req.body, true);
    if (req.file) uploadedImage = await uploadProgramImage(req.file);
    const program = await prisma.programDonasi.create({ data: { ...fields, imageUrl: uploadedImage?.url || null, imagePublicId: uploadedImage?.publicId || null } });
    res.status(201).json({ message: "Program donasi berhasil dibuat!", data: program });
  } catch (error) {
    if (uploadedImage) await cleanupImage(uploadedImage.publicId);
    sendError(res, error, "Gagal membuat program donasi.");
  }
};

exports.updateProgram = async (req, res) => {
  let uploadedImage = null;
  try {
    const id = programId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID program tidak valid." });
    const existing = await prisma.programDonasi.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: "Program tidak ditemukan." });
    const fields = programFields(req.body);
    const removeImage = req.body.removeImage === true || req.body.removeImage === "true";
    if (removeImage && req.file) return res.status(400).json({ message: "Pilih ganti atau hapus gambar, bukan keduanya." });
    if (!Object.keys(fields).length && !req.file && !removeImage) return res.status(400).json({ message: "Tidak ada perubahan program." });
    if (removeImage && isManagedProgramImage(existing.imagePublicId)) assertProgramImageStorageReady();

    if (req.file) uploadedImage = await uploadProgramImage(req.file);
    const imageUrl = uploadedImage?.url || (removeImage ? null : existing.imageUrl);
    const imagePublicId = uploadedImage?.publicId || (removeImage ? null : existing.imagePublicId);
    const program = await prisma.programDonasi.update({ where: { id }, data: { ...fields, imageUrl, imagePublicId } });
    const cleanupPending = existing.imagePublicId !== imagePublicId ? await cleanupImage(existing.imagePublicId) : false;
    res.json({ message: "Program berhasil diperbarui.", data: program, cleanupPending });
  } catch (error) {
    if (uploadedImage) await cleanupImage(uploadedImage.publicId);
    sendError(res, error, "Gagal memperbarui program.");
  }
};

exports.deleteProgram = async (req, res) => {
  try {
    const id = programId(req.params.id);
    if (!id) return res.status(400).json({ message: "ID program tidak valid." });
    const existing = await prisma.programDonasi.findUnique({
      where: { id },
      include: { _count: { select: { donasi: true, penyaluranBantuan: true } } },
    });
    if (!existing) return res.status(404).json({ message: "Program tidak ditemukan." });
    if (existing._count.donasi || existing._count.penyaluranBantuan) {
      return res.status(409).json({ message: "Program memiliki riwayat donasi atau penyaluran dan tidak dapat dihapus demi menjaga laporan." });
    }
    if (isManagedProgramImage(existing.imagePublicId)) assertProgramImageStorageReady();
    await prisma.programDonasi.delete({ where: { id } });
    const cleanupPending = await cleanupImage(existing.imagePublicId);
    res.json({ message: "Program donasi berhasil dihapus!", cleanupPending });
  } catch (error) {
    sendError(res, error, "Gagal menghapus program.");
  }
};
