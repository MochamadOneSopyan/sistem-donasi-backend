const test = require("node:test");
const assert = require("node:assert/strict");
const { authorize, isAdmin } = require("./middleware/authMiddleware");
const { can, STAFF_ROLES, ALL_ROLES, PERMISSIONS } = require("./roles");
const { ACCOUNTS } = require("../scripts/seedRoleAccounts");

function run(middleware, role) {
  let status = 200;
  let nextCalled = false;
  const res = { status(code) { status = code; return this; }, json() { return this; } };
  middleware({ user: role ? { role } : undefined }, res, () => { nextCalled = true; });
  return nextCalled ? 200 : status;
}

test("Admin Sistem dan Bidang Informatika punya akses penuh", () => {
  for (const role of ["ADMIN_SISTEM", "BIDANG_INFORMATIKA"]) {
    for (const permission of Object.keys(PERMISSIONS)) assert.equal(can(role, permission), true, `${role} ${permission}`);
    assert.equal(run(isAdmin, role), 200);
  }
});

test("hak akses tiap jabatan sesuai matriks RBAC", () => {
  assert.equal(run(authorize("VERIFIKASI_DONASI"), "BENDAHARA"), 200);
  assert.equal(run(authorize("VERIFIKASI_DONASI"), "KETUA"), 403);
  assert.equal(run(authorize("KELOLA_PROGRAM"), "KETUA"), 200);
  assert.equal(run(authorize("KELOLA_PROGRAM"), "BENDAHARA"), 403);
  assert.equal(run(authorize("KELOLA_PENYALURAN"), "BIDANG_SOSIAL"), 200);
  assert.equal(run(authorize("KELOLA_PENYALURAN"), "BIDANG_KESEHATAN"), 200);
  assert.equal(run(authorize("KELOLA_PENYALURAN"), "KETUA"), 403);
  assert.equal(run(authorize("LIHAT_LAPORAN"), "PENGAWAS"), 200);
  assert.equal(run(authorize("LIHAT_LAPORAN"), "PEMBINA"), 200);
  assert.equal(run(authorize("VERIFIKASI_DONASI"), "HUMAS"), 403);
  assert.equal(run(authorize("VERIFIKASI_PENGAJUAN"), "SEKRETARIS"), 403);
  assert.equal(run(isAdmin, "KETUA"), 403);
});

test("donatur, penerima, dan tamu ditolak dari endpoint pengurus", () => {
  for (const permission of Object.keys(PERMISSIONS)) {
    assert.equal(run(authorize(permission), "DONATUR"), 403);
    assert.equal(run(authorize(permission), "PENERIMA_BANTUAN"), 403);
    assert.equal(run(authorize(permission), undefined), 403);
  }
});

test("permission yang salah ketik langsung error saat route dibuat", () => {
  assert.throws(() => authorize("PERMISSION_NGASAL"), /tidak dikenal/);
});

test("hanya 13 role murni sesuai Use Case Diagram dan Excel", () => {
  assert.equal(ALL_ROLES.length, 13);
  assert.equal(ALL_ROLES.includes("PENGURUS"), false);
  assert.equal(STAFF_ROLES.includes("DONATUR"), false);
  assert.equal(new Set(ACCOUNTS.map((a) => a.email)).size, 13);
  assert.deepEqual(new Set(ACCOUNTS.map((a) => a.role)), new Set(ALL_ROLES));
});
