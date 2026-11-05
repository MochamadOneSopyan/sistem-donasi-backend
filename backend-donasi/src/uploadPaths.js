const path = require("node:path");

function getUploadsDir() {
  const configured = process.env.UPLOADS_DIR;
  if (configured && !path.isAbsolute(configured)) {
    throw new Error("UPLOADS_DIR harus berupa path absolut.");
  }
  return configured || path.join(__dirname, "../uploads");
}

function getUploadFilePath(kind, filename) {
  return path.join(getUploadsDir(), kind, filename);
}

module.exports = { getUploadsDir, getUploadFilePath };
