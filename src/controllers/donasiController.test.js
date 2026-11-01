const test = require("node:test");
const assert = require("node:assert/strict");

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function withController(fakePrisma, run) {
  const dbPath = require.resolve("../db");
  const controllerPath = require.resolve("./donasiController");
  const originalDb = require.cache[dbPath];
  const originalController = require.cache[controllerPath];
  const originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-secret-with-enough-entropy-for-unit-tests";
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: fakePrisma };
  delete require.cache[controllerPath];
  const controller = require("./donasiController");
  return Promise.resolve().then(() => run(controller)).finally(() => {
    if (originalDb) require.cache[dbPath] = originalDb; else delete require.cache[dbPath];
    if (originalController) require.cache[controllerPath] = originalController; else delete require.cache[controllerPath];
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
  });
}

test("permintaan donasi berulang memakai transaksi yang sama tanpa menaikkan saldo", async () => {
  let stored = null;
  let creates = 0;
  const db = { donasi: {
    findUnique: async ({ where }) => stored?.requestId === where.requestId ? stored : null,
    create: async ({ data }) => { creates++; stored = { id: 21, ...data }; return stored; },
  } };
  await withController(db, async (controller) => {
    const requestId = "123e4567-e89b-42d3-a456-426614174000";
    const req = { body: { programId: 3, jumlah: 20000, requestId }, headers: {} };
    const first = response();
    const second = response();
    await controller.createDonasi(req, first);
    await controller.createDonasi(req, second);
    assert.equal(first.statusCode, 201);
    assert.equal(second.statusCode, 200);
    assert.equal(first.body.data.id, second.body.data.id);
    assert.equal(creates, 1);
    assert.ok(first.body.proofToken);
  });
});

test("verifikasi ganda hanya menambah dana program sekali", async () => {
  let status = "PENDING";
  let balance = 0;
  const donation = { id: 7, jumlah: 50000, programId: 2 };
  const db = {
    donasi: {
      updateMany: async ({ where, data }) => {
        if (where.id !== 7 || status !== "PENDING") return { count: 0 };
        status = data.status;
        return { count: 1 };
      },
      findUnique: async () => ({ ...donation, status }),
    },
    programDonasi: { update: async ({ data }) => { balance += data.terkumpul.increment; } },
  };
  db.$transaction = async (fn) => fn(db);
  await withController(db, async (controller) => {
    const req = { params: { id: "7" }, body: { status: "BERHASIL" } };
    const first = response();
    const second = response();
    await Promise.all([controller.verifikasiDonasi(req, first), controller.verifikasiDonasi(req, second)]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409]);
    assert.equal(balance, 50000);
  });
});

test("laporan publik tidak meminta identitas penerima dan menampilkan selisih dana", async () => {
  let disbursementSelect;
  const db = {
    donasi: {
      aggregate: async () => ({ _sum: { jumlah: 100000 }, _count: { id: 1 } }),
      findMany: async () => [],
    },
    penyaluranBantuan: {
      aggregate: async () => ({ _sum: { jumlahBantuan: 120000 }, _count: { id: 1 } }),
      findMany: async (query) => {
        if (query.take) disbursementSelect = query.select;
        return [];
      },
    },
    programDonasi: { findMany: async () => [] },
  };
  await withController(db, async (controller) => {
    const res = response();
    await controller.getLaporanTransparansi({}, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.data.sisaSaldo, -20000);
    assert.deepEqual(Object.keys(disbursementSelect).sort(), ["id", "jumlahBantuan", "program", "tanggalSalur"]);
    assert.ok(res.body.data.laporanDibuatPada);
  });
});

test("bukti pembayaran hanya dapat dibaca pemilik akun atau pengurus", async () => {
  const db = { donasi: { findUnique: async () => ({ donaturId: 4, buktiPembayaran: "/uploads/bukti/bukti-1234-1.jpg" }) } };
  await withController(db, async (controller) => {
    const forbidden = response();
    await controller.getBuktiDonasi({ params: { id: "7" }, user: { id: 5, role: "DONATUR" } }, forbidden);
    assert.equal(forbidden.statusCode, 403);

    const owner = { ...response(), set(name, value) { this.headers ??= {}; this.headers[name] = value; return this; }, sendFile(file) { this.file = file; return this; } };
    await controller.getBuktiDonasi({ params: { id: "7" }, user: { id: 4, role: "DONATUR" } }, owner);
    assert.match(owner.file, /uploads\/bukti\/bukti-1234-1\.jpg$/);
    assert.equal(owner.headers["Cache-Control"], "private, no-store");
  });
});
