const test = require("node:test");
const assert = require("node:assert/strict");
const sharp = require("sharp");
const { Writable } = require("node:stream");
const cloudinary = require("cloudinary").v2;
const { MAX_UPLOAD_BYTES, prepareProgramImage, uploadProgramImage, deleteProgramImage, isManagedProgramImage, assertProgramImageStorageReady } = require("./programImageStorage");

for (const [mime, format] of [["image/jpeg", "jpeg"], ["image/png", "png"], ["image/webp", "webp"]]) {
  test(`gambar ${format} valid diproses menjadi WebP`, async () => {
    const buffer = await sharp({ create: { width: 16, height: 12, channels: 3, background: "#065642" } }).toFormat(format).toBuffer();
    const output = await prepareProgramImage({ mimetype: mime, buffer });
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, 16);
    assert.equal(metadata.height, 12);
  });
}

test("ukuran lebih dari 5 MB ditolak", async () => {
  await assert.rejects(prepareProgramImage({ mimetype: "image/jpeg", buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1) }), /maksimal 5 MB/);
});

test("MIME salah dan isi rusak ditolak", async () => {
  await assert.rejects(prepareProgramImage({ mimetype: "text/plain", buffer: Buffer.from("not an image") }), /JPG, PNG, atau WebP/);
  await assert.rejects(prepareProgramImage({ mimetype: "image/jpeg", buffer: Buffer.from("not an image") }), /rusak atau tidak dapat diproses/);
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#000" } }).png().toBuffer();
  await assert.rejects(prepareProgramImage({ mimetype: "image/jpeg", buffer: png }), /tidak sesuai/);
});

test("hanya public_id gambar program yang dapat dibersihkan", () => {
  assert.equal(isManagedProgramImage("yayasan/programs/123e4567-e89b-42d3-a456-426614174000"), true);
  assert.equal(isManagedProgramImage("yayasan/avatars/123e4567-e89b-42d3-a456-426614174000"), false);
  assert.equal(isManagedProgramImage("https://res.cloudinary.com/test/image/upload/other.webp"), false);
});

test("Cloudinary membutuhkan konfigurasi backend dan mengembalikan secure_url serta public_id", async () => {
  const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalUpload = cloudinary.uploader.upload_stream;
  const originalDestroy = cloudinary.uploader.destroy;
  const deleted = [];
  try {
    for (const key of keys) delete process.env[key];
    assert.throws(() => assertProgramImageStorageReady(), /belum dikonfigurasi/);
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "**********";
    assert.throws(() => assertProgramImageStorageReady(), /masih berupa karakter sensor/);
    process.env.CLOUDINARY_API_SECRET = "test-secret";
    cloudinary.uploader.upload_stream = (options, callback) => {
      assert.equal(options.overwrite, false);
      assert.equal(options.format, "webp");
      const chunks = [];
      const stream = new Writable({ write(chunk, _encoding, done) { chunks.push(chunk); done(); } });
      stream.on("finish", async () => {
        assert.equal((await sharp(Buffer.concat(chunks)).metadata()).format, "webp");
        callback(null, { public_id: options.public_id, secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${options.public_id}.webp` });
      });
      return stream;
    };
    cloudinary.uploader.destroy = async (publicId, options) => { deleted.push([publicId, options]); return { result: "ok" }; };
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#065642" } }).png().toBuffer();
    const uploaded = await uploadProgramImage({ mimetype: "image/png", buffer });
    assert.match(uploaded.url, /^https:\/\/res\.cloudinary\.com\/test-cloud\/image\/upload\//);
    assert.equal(isManagedProgramImage(uploaded.publicId), true);
    assert.equal(await deleteProgramImage(uploaded.publicId), true);
    assert.equal(deleted[0][0], uploaded.publicId);
    assert.equal(await deleteProgramImage("outside-folder"), false);
    assert.equal(deleted.length, 1);
  } finally {
    cloudinary.uploader.upload_stream = originalUpload;
    cloudinary.uploader.destroy = originalDestroy;
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
