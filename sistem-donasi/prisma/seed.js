const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  await prisma.programDonasi.createMany({
    data: [
      {
        judul: "Santunan Yatim & Dhuafa",
        deskripsi:
          "Program bantuan biaya pendidikan, kebutuhan pokok, dan perlengkapan sekolah bagi anak-anak yatim serta keluarga dhuafa.",
        targetDana: 15000000,
        terkumpul: 0,
      },
      {
        judul: "Pendidikan & Tahfidz Al-Qur'an",
        deskripsi:
          "Bantuan fasilitasi pembelajaran, kitab Al-Qur'an, dan beasiswa untuk santri penghafal Al-Qur'an.",
        targetDana: 20000000,
        terkumpul: 0,
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeding program donasi berhasil!");
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
