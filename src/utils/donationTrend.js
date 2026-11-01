const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

function monthInJakarta(date) {
  return new Date(new Date(date).getTime() + JAKARTA_OFFSET_MS)
    .toISOString()
    .slice(0, 7);
}

function getSixMonthStart(now = new Date()) {
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  return new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth() - 5, 1, -7));
}

function summarizeSixMonths(transactions, now = new Date(), distributions = []) {
  const jakartaNow = new Date(now.getTime() + JAKARTA_OFFSET_MS);
  const months = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(Date.UTC(jakartaNow.getUTCFullYear(), jakartaNow.getUTCMonth() - 5 + index, 1));
    return { bulan: month.toISOString().slice(0, 7), jumlah: 0, transaksi: 0, tersalurkan: 0, penyaluran: 0 };
  });
  const byMonth = new Map(months.map((item) => [item.bulan, item]));

  for (const transaction of transactions) {
    const month = byMonth.get(monthInJakarta(transaction.createdAt));
    if (!month) continue;
    month.jumlah += Number(transaction.jumlah || 0);
    month.transaksi += 1;
  }

  for (const distribution of distributions) {
    const month = byMonth.get(monthInJakarta(distribution.tanggalSalur));
    if (!month) continue;
    month.tersalurkan += Number(distribution.jumlahBantuan || 0);
    month.penyaluran += 1;
  }

  return months;
}

module.exports = { getSixMonthStart, summarizeSixMonths };
