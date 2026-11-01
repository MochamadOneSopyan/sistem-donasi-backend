const test = require("node:test");
const assert = require("node:assert/strict");

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test("CRUD gambar Cloudinary menjaga data donasi dan membersihkan public_id lama", async () => {
  const dbPath = require.resolve("../db");
  const storagePath = require.resolve("../services/programImageStorage");
  const controllerPath = require.resolve("./programController");
  const originalDb = require.cache[dbPath];
  const originalStorage = require.cache[storagePath];
  const originalController = require.cache[controllerPath];
  const oldId = "yayasan/programs/123e4567-e89b-42d3-a456-426614174000";
  const newId = "yayasan/programs/123e4567-e89b-42d3-a456-426614174001";
  const uploaded = { url: `https://res.cloudinary.com/test/image/upload/v1/${newId}.webp`, publicId: newId };
  const updates = [];
  const deletedImages = [];
  const deletedPrograms = [];
  let historyCount = 1;
  let existing = { id: 1, judul: "Program", imageUrl: "https://res.cloudinary.com/test/image/upload/v1/old.webp", imagePublicId: oldId };
  const fakePrisma = { programDonasi: {
    create: async ({ data }) => ({ id: 2, ...data }),
    findUnique: async () => ({ ...existing, _count: { donasi: historyCount, penyaluranBantuan: 0 } }),
    update: async ({ data }) => { updates.push(data); existing = { ...existing, ...data }; return existing; },
    delete: async ({ where }) => { deletedPrograms.push(where.id); return { id: where.id }; },
  } };
  const fakeStorage = {
    uploadProgramImage: async () => uploaded,
    deleteProgramImage: async (publicId) => { deletedImages.push(publicId); return true; },
    isManagedProgramImage: (publicId) => Boolean(publicId),
    assertProgramImageStorageReady: () => {},
  };

  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePrisma };
  require.cache[storagePath] = { id: storagePath, filename: storagePath, loaded: true, exports: fakeStorage };
  delete require.cache[controllerPath];
  const controller = require("./programController");
  try {
    const created = response();
    await controller.createProgram({ body: { judul: "Baru", deskripsi: "Deskripsi", targetDana: "10000" }, file: { buffer: Buffer.from("x") } }, created);
    assert.equal(created.statusCode, 201);
    assert.equal(created.body.data.imageUrl, uploaded.url);
    assert.equal(created.body.data.imagePublicId, newId);
    assert.equal(created.body.data.terkumpul, undefined);

    const replaced = response();
    await controller.updateProgram({ params: { id: "1" }, body: {}, file: { buffer: Buffer.from("y") } }, replaced);
    assert.equal(replaced.statusCode, 200);
    assert.deepEqual(Object.keys(updates[0]), ["imageUrl", "imagePublicId"]);
    assert.equal(updates[0].terkumpul, undefined);
    assert.deepEqual(deletedImages, [oldId]);

    const removed = response();
    await controller.updateProgram({ params: { id: "1" }, body: { removeImage: "true" } }, removed);
    assert.equal(removed.statusCode, 200);
    assert.equal(removed.body.data.imageUrl, null);
    assert.equal(removed.body.data.imagePublicId, null);
    assert.deepEqual(deletedImages, [oldId, newId]);

    const blocked = response();
    await controller.deleteProgram({ params: { id: "1" } }, blocked);
    assert.equal(blocked.statusCode, 409);
    assert.deepEqual(deletedPrograms, []);

    historyCount = 0;
    existing = { ...existing, imageUrl: "https://res.cloudinary.com/test/image/upload/v1/old.webp", imagePublicId: oldId };
    const deleted = response();
    await controller.deleteProgram({ params: { id: "1" } }, deleted);
    assert.equal(deleted.statusCode, 200);
    assert.deepEqual(deletedPrograms, [1]);
    assert.deepEqual(deletedImages, [oldId, newId, oldId]);
  } finally {
    if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
    if (originalStorage) require.cache[storagePath] = originalStorage; else delete require.cache[storagePath];
    if (originalController) require.cache[controllerPath] = originalController; else delete require.cache[controllerPath];
  }
});

test("daftar program publik tidak memuat data penerima atau catatan bebas", async () => {
  const dbPath = require.resolve("../db");
  const controllerPath = require.resolve("./programController");
  const originalDb = require.cache[dbPath];
  const originalController = require.cache[controllerPath];
  let query;
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
    programDonasi: { findMany: async (input) => { query = input; return []; } },
  } };
  delete require.cache[controllerPath];
  try {
    const controller = require("./programController");
    const res = response();
    await controller.getAllProgram({ headers: {} }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(query.select.penyaluranBantuan.select).sort(), ["id", "jumlahBantuan", "tanggalSalur"]);
    assert.deepEqual(query.select.donasi.where, { status: "BERHASIL" });
  } finally {
    if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
    if (originalController) require.cache[controllerPath] = originalController; else delete require.cache[controllerPath];
  }
});
