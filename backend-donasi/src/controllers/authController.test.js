const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function withController(db, sendMail, run) {
  const dbPath = require.resolve("../db");
  const mailPath = require.resolve("nodemailer");
  const controllerPath = require.resolve("./authController");
  const previous = [dbPath, mailPath, controllerPath].map((path) => require.cache[path]);
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db };
  require.cache[mailPath] = { id: mailPath, filename: mailPath, loaded: true, exports: { createTransport: () => ({ sendMail }) } };
  delete require.cache[controllerPath];
  try {
    await run(require("./authController"));
  } finally {
    [dbPath, mailPath, controllerPath].forEach((path, index) => {
      if (previous[index]) require.cache[path] = previous[index];
      else delete require.cache[path];
    });
  }
}

test("pendaftaran publik tidak dapat membuat akun pengurus", async () => {
  const db = { user: { findUnique: () => { throw new Error("Database tidak boleh diakses"); } } };
  await withController(db, async () => {}, async (controller) => {
    const res = response();
    await controller.register({ body: { nama: "Seseorang", email: "a@example.com", password: "password123", role: "ADMIN_SISTEM" } }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /Peran/);
  });
});

test("tautan pemulihan hanya dikirim lewat email dan tidak dapat dipakai dua kali", async () => {
  const keys = ["JWT_SECRET", "SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "CLIENT_URL"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    JWT_SECRET: "test-secret-for-password-recovery",
    SMTP_HOST: "smtp.example.com",
    SMTP_PORT: "587",
    SMTP_USER: "user",
    SMTP_PASS: "pass",
    SMTP_FROM: "Yayasan <noreply@example.com>",
    CLIENT_URL: "https://frontend.example.com",
  });
  let password = "existing-password-hash";
  let sentMail;
  const db = { user: {
    findUnique: async ({ where }) => where.email === "a@example.com" || where.id === 7 ? { id: 7, email: "a@example.com", password } : null,
    updateMany: async ({ where, data }) => {
      if (where.id !== 7 || where.password !== password) return { count: 0 };
      password = data.password;
      return { count: 1 };
    },
  } };
  try {
    await withController(db, async (message) => { sentMail = message; }, async (controller) => {
      const forgot = response();
      await controller.forgotPassword({ body: { email: "a@example.com" } }, forgot);
      assert.equal(forgot.statusCode, 200);
      assert.equal(forgot.body.resetUrl, undefined);
      assert.equal(sentMail.to, "a@example.com");
      assert.match(sentMail.subject, /kata sandi/i);
      assert.match(sentMail.text, /15 menit/);
      assert.match(sentMail.text, /abaikan email ini/i);
      const token = sentMail.text.match(/reset-password\/([^\s]+)/)[1];
      assert.match(sentMail.html, new RegExp(`href="https://frontend\\.example\\.com/reset-password/${token}"`));
      assert.match(sentMail.html, /15 menit/);

      const loginToken = jwt.sign({ id: 7, role: "DONATUR" }, process.env.JWT_SECRET);
      const wrongPurpose = response();
      await controller.resetPasswordWithToken({ body: { token: loginToken, passwordBaru: "new-password" } }, wrongPurpose);
      assert.equal(wrongPurpose.statusCode, 400);

      const reset = response();
      await controller.resetPasswordWithToken({ body: { token, passwordBaru: "new-password" } }, reset);
      assert.equal(reset.statusCode, 200);

      const replay = response();
      await controller.resetPasswordWithToken({ body: { token, passwordBaru: "another-password" } }, replay);
      assert.equal(replay.statusCode, 400);

      sentMail = undefined;
      const unknown = response();
      await controller.forgotPassword({ body: { email: "unknown@example.com" } }, unknown);
      assert.equal(unknown.statusCode, 200);
      assert.equal(unknown.body.message, forgot.body.message);
      assert.equal(sentMail, undefined);
    });
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
