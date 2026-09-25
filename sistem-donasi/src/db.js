const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

prisma.$connect()
  .then(() => console.log("✅ Database connected"))
  .catch((err) => console.error("❌ Database connection failed:", err));

module.exports = prisma;
