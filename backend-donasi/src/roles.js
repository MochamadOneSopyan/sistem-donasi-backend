// Definisi 13 role & hak akses (RBAC) sesuai Use Case Diagram yayasan.
// Satu sumber kebenaran: dipakai oleh middleware, controller, dan seed akun.

const ROLES = Object.freeze({
  DONATUR: "DONATUR",
  PENERIMA_BANTUAN: "PENERIMA_BANTUAN",
  ADMIN_SISTEM: "ADMIN_SISTEM",
  BIDANG_INFORMATIKA: "BIDANG_INFORMATIKA",
  KETUA: "KETUA",
  BENDAHARA: "BENDAHARA",
  SEKRETARIS: "SEKRETARIS",
  BIDANG_SOSIAL: "BIDANG_SOSIAL",
  BIDANG_PENDIDIKAN: "BIDANG_PENDIDIKAN",
  BIDANG_KESEHATAN: "BIDANG_KESEHATAN",
  HUMAS: "HUMAS",
  PENGAWAS: "PENGAWAS",
  PEMBINA: "PEMBINA",
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

// Role dengan akses penuh ke seluruh panel pengurus.
const FULL_ACCESS_ROLES = Object.freeze([
  ROLES.ADMIN_SISTEM,
  ROLES.BIDANG_INFORMATIKA,
]);

// Semua role pengurus yang boleh masuk panel (/admin).
const STAFF_ROLES = Object.freeze(
  ALL_ROLES.filter((role) => role !== ROLES.DONATUR && role !== ROLES.PENERIMA_BANTUAN),
);

const ASSIGNABLE_STAFF_ROLES = STAFF_ROLES;

const BIDANG = [ROLES.BIDANG_SOSIAL, ROLES.BIDANG_PENDIDIKAN, ROLES.BIDANG_KESEHATAN];
const PEMANTAU_LAPORAN = [
  ROLES.KETUA,
  ROLES.BENDAHARA,
  ROLES.SEKRETARIS,
  ROLES.PENGAWAS,
  ROLES.PEMBINA,
  ROLES.HUMAS,
  ...BIDANG,
];

// Hak akses per kemampuan. FULL_ACCESS_ROLES selalu diizinkan (lihat `can`).
const PERMISSIONS = Object.freeze({
  LIHAT_RINGKASAN: STAFF_ROLES,
  KELOLA_PROGRAM: [ROLES.KETUA, ROLES.HUMAS],
  VERIFIKASI_DONASI: [ROLES.BENDAHARA],
  LIHAT_DONASI: [ROLES.BENDAHARA, ROLES.KETUA, ROLES.SEKRETARIS, ROLES.PENGAWAS, ROLES.PEMBINA],
  LIHAT_DONATUR: [ROLES.BENDAHARA],
  LIHAT_PENERIMA: [ROLES.KETUA, ROLES.SEKRETARIS, ...BIDANG],
  KELOLA_PENERIMA: [ROLES.KETUA, ...BIDANG],
  LIHAT_PENGAJUAN: [ROLES.KETUA, ROLES.SEKRETARIS, ...BIDANG],
  VERIFIKASI_PENGAJUAN: [ROLES.KETUA, ...BIDANG],
  KELOLA_PENYALURAN: BIDANG,
  LIHAT_LAPORAN: PEMANTAU_LAPORAN,
  KELOLA_PENGGUNA: [],
});

const isFullAccess = (role) => FULL_ACCESS_ROLES.includes(role);
const isStaff = (role) => STAFF_ROLES.includes(role);

function can(role, permission) {
  if (!role) return false;
  if (isFullAccess(role)) return true;
  const allowed = PERMISSIONS[permission];
  if (!allowed) throw new Error(`Permission tidak dikenal: ${permission}`);
  return allowed.includes(role);
}

module.exports = {
  ROLES,
  ALL_ROLES,
  FULL_ACCESS_ROLES,
  STAFF_ROLES,
  ASSIGNABLE_STAFF_ROLES,
  PERMISSIONS,
  isFullAccess,
  isStaff,
  can,
};
