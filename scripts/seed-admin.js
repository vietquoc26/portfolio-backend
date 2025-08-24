// scripts/seed-admin.js
import bcrypt from "bcrypt";
import { pool } from "../db.js";
import "dotenv/config";

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    console.error("❌ Set ADMIN_USERNAME and ADMIN_PASSWORD in .env");
    process.exit(1);
  }

  const result = await pool.query("SELECT id FROM admins WHERE username = $1", [username]);
  if (result.rows.length) {
    console.log("⚠️ Admin already exists:", username);
    process.exit(0);
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query("INSERT INTO admins (username, password_hash) VALUES ($1, $2)", [username, hash]);

  console.log("✅ Admin created:", username);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
