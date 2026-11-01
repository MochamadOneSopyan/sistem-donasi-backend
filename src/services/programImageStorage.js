const { randomUUID } = require("node:crypto");
const sharp = require("sharp");
const cloudinary = require("cloudinary").v2;

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const INPUT_FORMATS = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};
const PROGRAM_PUBLIC_ID = /^yayasan\/programs\/[0-9a-f-]{36}$/;

function imageError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function assertProgramImageStorageReady() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } =
    process.env;
  if (
    ![CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET].every(
      (value) => value?.trim(),
    )
  ) {
    throw imageError(
      "Penyimpanan gambar Cloudinary belum dikonfigurasi oleh pengurus.",
      503,
    );
  }
  if (/^[*•●]+$/.test(CLOUDINARY_API_SECRET.trim())) {
    throw imageError(
      "API Secret Cloudinary masih berupa karakter sensor. Salin nilai asli dari halaman API Keys Cloudinary ke backend-donasi/.env.",
      503,
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

async function prepareProgramImage(file) {
  if (!file?.buffer?.length)
    throw imageError("Pilih gambar program terlebih dahulu.");
  if (file.buffer.length > MAX_UPLOAD_BYTES)
    throw imageError("Ukuran gambar maksimal 5 MB.");
  const expectedFormat = INPUT_FORMATS[file.mimetype];
  if (!expectedFormat)
    throw imageError("Format gambar harus JPG, PNG, atau WebP.");

  try {
    const image = sharp(file.buffer, {
      failOn: "error",
      limitInputPixels: 40_000_000,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== expectedFormat ||
      !metadata.width ||
      !metadata.height
    ) {
      throw imageError(
        "Isi file tidak sesuai dengan format gambar yang dipilih.",
      );
    }
    const buffer = await image
      .rotate()
      .resize({
        width: 1600,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 84 })
      .toBuffer();
    if (buffer.length > MAX_UPLOAD_BYTES)
      throw imageError("Gambar hasil pemrosesan melebihi 5 MB.");
    return buffer;
  } catch (error) {
    if (error.status) throw error;
    throw imageError("Gambar rusak atau tidak dapat diproses.");
  }
}

async function uploadProgramImage(file) {
  const buffer = await prepareProgramImage(file);
  assertProgramImageStorageReady();
  const publicId = `yayasan/programs/${randomUUID()}`;
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          overwrite: false,
          format: "webp",
        },
        (error, uploaded) => (error ? reject(error) : resolve(uploaded)),
      );
      stream.on("error", reject);
      stream.end(buffer);
    });
  } catch (error) {
    console.error("Unggah gambar program ke Cloudinary gagal:", {
      code: error.http_code || error.status || "unknown",
    });
    throw imageError(
      "Gambar gagal diunggah ke Cloudinary. Periksa kredensial atau koneksi backend.",
      502,
    );
  }
  if (
    result?.public_id !== publicId ||
    !result?.secure_url?.startsWith(
      `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/`,
    )
  ) {
    throw imageError(
      "Cloudinary tidak mengembalikan URL gambar yang valid.",
      502,
    );
  }
  return { url: result.secure_url, publicId: result.public_id };
}

function isManagedProgramImage(publicId) {
  return typeof publicId === "string" && PROGRAM_PUBLIC_ID.test(publicId);
}

async function deleteProgramImage(publicId) {
  if (!isManagedProgramImage(publicId)) return false;
  assertProgramImageStorageReady();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
  if (result?.result !== "ok" && result?.result !== "not found") {
    throw imageError("Gambar lama gagal dihapus dari Cloudinary.", 502);
  }
  return true;
}

module.exports = {
  MAX_UPLOAD_BYTES,
  INPUT_FORMATS,
  prepareProgramImage,
  uploadProgramImage,
  deleteProgramImage,
  isManagedProgramImage,
  assertProgramImageStorageReady,
};
