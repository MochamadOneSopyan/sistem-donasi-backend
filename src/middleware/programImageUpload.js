const multer = require("multer");
const { MAX_UPLOAD_BYTES, INPUT_FORMATS } = require("../services/programImageStorage");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => {
    if (!INPUT_FORMATS[file.mimetype]) {
      const error = new Error("Format gambar harus JPG, PNG, atau WebP.");
      error.status = 400;
      return callback(error);
    }
    callback(null, true);
  },
}).single("image");

module.exports = function programImageUpload(req, res, next) {
  upload(req, res, (error) => {
    if (!error) return next();
    if (error.code === "LIMIT_FILE_SIZE") return res.status(413).json({ message: "Ukuran gambar maksimal 5 MB." });
    if (error.code === "LIMIT_UNEXPECTED_FILE" || error.code === "LIMIT_FILE_COUNT") return res.status(400).json({ message: "Unggah satu gambar program saja." });
    return res.status(error.status || 400).json({ message: error.message || "Gambar tidak dapat diunggah." });
  });
};
