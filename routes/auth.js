// routes/auth.js
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const router = Router();
const COOKIE_NAME = "aid"; // cookie name

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
  });
}

// ✅ Login
router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Missing credentials" });

  const result = await pool.query("SELECT * FROM admins WHERE username = $1", [username]);
  const admin = result.rows[0];
  if (!admin) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, admin.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: "7d" });
  setAuthCookie(res, token);
  res.json({ ok: true, username: admin.username });
});

// ✅ Logout
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

// ✅ Who am I
router.get("/me", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.json({ authenticated: false });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ authenticated: true, user: { id: payload.id, username: payload.username } });
  } catch {
    res.json({ authenticated: false });
  }
});

// ✅ Change password
router.post("/change-password", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: "Missing fields" });
  if (newPassword.length < 8) return res.status(400).json({ error: "Password too short (min 8)" });

  const result = await pool.query("SELECT * FROM admins WHERE id = $1", [payload.id]);
  const admin = result.rows[0];
  if (!admin) return res.status(404).json({ error: "Admin not found" });

  const ok = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!ok) return res.status(401).json({ error: "Current password incorrect" });

  const hash = await bcrypt.hash(newPassword, 12);
  await pool.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [hash, payload.id]);

  res.json({ ok: true });
});

export default router;
