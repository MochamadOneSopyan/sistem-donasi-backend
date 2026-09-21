const express = require("express");
const cors = require("cors");
require("dotenv").config();

const apiRoutes = require("./src/routes/api");

const app = express();
app.use(cors());
app.use(express.json());

// Hubungkan Rute API
app.use("/api", apiRoutes);

app.get("/", (req, res) => {
  res.json({ message: "API Sistem Donasi Yayasan Siap Digunakan!" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});
