const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");
const sharp = require("sharp");
const { authenticateToken, isAdmin } = require("./authMiddleware");
const programImageUpload = require("./programImageUpload");

test("upload program memerlukan admin dan membatasi format serta ukuran", async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "program-image-test-secret";
  const app = express();
  app.post("/program", authenticateToken, isAdmin, programImageUpload, (req, res) => res.json({ mime: req.file?.mimetype || null }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  const url = `http://127.0.0.1:${server.address().port}/program`;
  const request = async (token, buffer, mime) => {
    const body = new FormData();
    body.append("image", new Blob([buffer], { type: mime }), "program-image");
    return fetch(url, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body });
  };

  try {
    const donorToken = jwt.sign({ role: "DONATUR" }, process.env.JWT_SECRET);
    const adminToken = jwt.sign({ role: "ADMIN_SISTEM" }, process.env.JWT_SECRET);
    const jpg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#065642" } }).jpeg().toBuffer();
    assert.equal((await request(null, jpg, "image/jpeg")).status, 401);
    assert.equal((await request(donorToken, jpg, "image/jpeg")).status, 403);

    for (const [mime, format] of [["image/jpeg", "jpeg"], ["image/png", "png"], ["image/webp", "webp"]]) {
      const valid = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#065642" } }).toFormat(format).toBuffer();
      const response = await request(adminToken, valid, mime);
      assert.equal(response.status, 200);
      assert.equal((await response.json()).mime, mime);
    }
    assert.equal((await request(adminToken, Buffer.from("invalid"), "text/plain")).status, 400);
    assert.equal((await request(adminToken, Buffer.alloc(5 * 1024 * 1024 + 1), "image/jpeg")).status, 413);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
