const test = require("node:test");
const assert = require("node:assert/strict");
const { getSixMonthStart, summarizeSixMonths } = require("./donationTrend");

test("enam bulan mengikuti batas awal bulan di Jakarta", () => {
  const now = new Date("2026-10-27T00:00:00.000Z");
  assert.equal(getSixMonthStart(now).toISOString(), "2026-04-30T17:00:00.000Z");

  const trend = summarizeSixMonths([
    { jumlah: 100_000, createdAt: "2026-04-30T16:59:59.000Z" },
    { jumlah: 200_000, createdAt: "2026-04-30T17:00:00.000Z" },
    { jumlah: 300_000, createdAt: "2026-09-30T16:59:59.000Z" },
    { jumlah: 400_000, createdAt: "2026-09-30T17:00:00.000Z" },
  ], now, [
    { jumlahBantuan: 50_000, tanggalSalur: "2026-09-30T16:59:59.000Z" },
    { jumlahBantuan: 70_000, tanggalSalur: "2026-09-30T17:00:00.000Z" },
  ]);

  assert.deepEqual(trend.map(({ bulan, jumlah, transaksi }) => [bulan, jumlah, transaksi]), [
    ["2026-05", 200_000, 1],
    ["2026-06", 0, 0],
    ["2026-07", 0, 0],
    ["2026-08", 0, 0],
    ["2026-09", 300_000, 1],
    ["2026-10", 400_000, 1],
  ]);
  assert.equal(trend[4].tersalurkan, 50_000);
  assert.equal(trend[4].penyaluran, 1);
  assert.equal(trend[5].tersalurkan, 70_000);
  assert.equal(trend[5].penyaluran, 1);
});
