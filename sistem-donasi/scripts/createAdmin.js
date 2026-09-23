const prisma = require("../src/db");// sesuaikan path ke db.js kamu
const bcrypt = require("bcryptjs");

async function createAdmin() {
  const nama = "Admin Utama";
  const email = "admin@yayasan.com"; // ganti sesuai kebutuhan
  const password = "password123"; // ganti dengan password kuat

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("❌ Email sudah dipakai, admin tidak dibuat.");
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.create({
    data: {
      nama,
      email,
      password: hashedPassword,
      role: "PENGURUS",
    },
  });

  console.log("✅ Admin berhasil dibuat:", admin.email);
}

createAdmin()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
