// db.js
import pkg from "pg";
import "dotenv/config";

const { Pool } = pkg;

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false } // ✅ Render requires SSL
});
