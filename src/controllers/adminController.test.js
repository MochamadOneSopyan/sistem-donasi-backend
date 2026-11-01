const test = require("node:test");
const assert = require("node:assert/strict");

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

async function withController(db, run) {
  const dbPath = require.resolve("../db");
  const controllerPath = require.resolve("./adminController");
  const previousDb = require.cache[dbPath];
  const previousController = require.cache[controllerPath];
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
  delete require.cache[controllerPath];
  try { await run(require("./adminController")); }
  finally {
    if (previousDb) require.cache[dbPath] = previousDb; else delete require.cache[dbPath];
    if (previousController) require.cache[controllerPath] = previousController; else delete require.cache[controllerPath];
  }
}

test("pemohon hanya dapat membatalkan pengajuan miliknya yang menunggu", async () => {
  let status = "MENUNGGU";
  const db = { pengajuanBantuan: {
    updateMany: async ({ where, data }) => {
      if (where.userId !== 5 || where.status !== status) return { count: 0 };
      status = data.status;
      return { count: 1 };
    },
    findUnique: async () => ({ id: 4, userId: 5, status }),
  } };
  await withController(db, async (controller) => {
    const first = response();
    await controller.batalkanPengajuan({ params: { id: "4" }, user: { id: 5, role: "PENERIMA_BANTUAN" } }, first);
    assert.equal(first.statusCode, 200);
    assert.equal(first.body.data.status, "DIBATALKAN");

    const second = response();
    await controller.batalkanPengajuan({ params: { id: "4" }, user: { id: 5, role: "PENERIMA_BANTUAN" } }, second);
    assert.equal(second.statusCode, 409);

    const anotherUser = response();
    await controller.batalkanPengajuan({ params: { id: "4" }, user: { id: 8, role: "PENERIMA_BANTUAN" } }, anotherUser);
    assert.equal(anotherUser.statusCode, 403);
  });
});

test("pembatalan dan keputusan pengurus tidak dapat menimpa satu sama lain", async () => {
  let status = "MENUNGGU";
  const db = { pengajuanBantuan: {
    updateMany: async ({ where, data }) => {
      if (where.status !== status || (where.userId && where.userId !== 5)) return { count: 0 };
      status = data.status;
      return { count: 1 };
    },
    findUnique: async () => ({ id: 4, userId: 5, status, user: { nama: "Pemohon" } }),
  } };
  await withController(db, async (controller) => {
    const cancel = response();
    const verify = response();
    await Promise.all([
      controller.batalkanPengajuan({ params: { id: "4" }, user: { id: 5, role: "PENERIMA_BANTUAN" } }, cancel),
      controller.verifikasiPengajuan({ params: { id: "4" }, body: { status: "DISETUJUI" } }, verify),
    ]);
    assert.deepEqual([cancel.statusCode, verify.statusCode].sort(), [200, 409]);
    assert.equal(status, "DIBATALKAN");
  });
});

test("pemohon hanya dapat memiliki satu pengajuan yang menunggu", async () => {
  let activeId = null;
  let nextId = 10;
  const tx = {
    $queryRaw: async () => [{ id: 5 }],
    pengajuanBantuan: {
      findFirst: async ({ where }) => where.userId === 5 && where.status === "MENUNGGU" && activeId ? { id: activeId } : null,
      create: async ({ data }) => {
        activeId = nextId++;
        return { id: activeId, ...data };
      },
    },
  };
  const db = { $transaction: async (callback) => callback(tx) };
  const request = { user: { id: 5, role: "PENERIMA_BANTUAN" }, body: { judul: "Bantuan pangan", deskripsi: "Kebutuhan pangan keluarga", jumlahDiajukan: 50000 } };

  await withController(db, async (controller) => {
    const first = response();
    await controller.buatPengajuan(request, first);
    assert.equal(first.statusCode, 201);

    const duplicate = response();
    await controller.buatPengajuan(request, duplicate);
    assert.equal(duplicate.statusCode, 409);

    activeId = null;
    const afterCancel = response();
    await controller.buatPengajuan(request, afterCancel);
    assert.equal(afterCancel.statusCode, 201);
    assert.notEqual(afterCancel.body.data.id, first.body.data.id);
  });
});
