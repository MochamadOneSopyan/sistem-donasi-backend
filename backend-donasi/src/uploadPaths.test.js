const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { getUploadsDir, getUploadFilePath } = require("./uploadPaths");

test("direktori unggahan dapat diarahkan ke volume persisten", () => {
  const previous = process.env.UPLOADS_DIR;
  try {
    delete process.env.UPLOADS_DIR;
    assert.equal(getUploadsDir(), path.join(__dirname, "../uploads"));

    process.env.UPLOADS_DIR = "/data/uploads";
    assert.equal(getUploadFilePath("bukti", "bukti-1.jpg"), "/data/uploads/bukti/bukti-1.jpg");
    assert.equal(getUploadFilePath("avatars", "avatar-1.jpg"), "/data/uploads/avatars/avatar-1.jpg");

    process.env.UPLOADS_DIR = "uploads";
    assert.throws(getUploadsDir, /path absolut/);
  } finally {
    if (previous === undefined) delete process.env.UPLOADS_DIR;
    else process.env.UPLOADS_DIR = previous;
  }
});
