// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import pkg from "pg";

import authRoutes from "./routes/auth.js";

dotenv.config();

const { Pool } = pkg;
const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// 🗄️ PostgreSQL Connection
// =======================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Internal Render DB does not require SSL
});

// Test DB connection at startup
pool.connect()
  .then(() => console.log("✅ Connected to PostgreSQL on Render"))
  .catch((err) => console.error("❌ Database connection error:", err));

// Middleware
app.use(helmet());
app.use(cors({
  origin: "https://www.vietportfolio.work.gd", // allow only your frontend
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Limit auth requests
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/auth", authLimiter);

// =======================
// 📩 Contact Form → Brevo
// =======================
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, phone, message, timestamp } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: "Name, Email, and Message are required.",
      });
    }

    const contactTimestamp = timestamp || new Date().toISOString();

    // 1️⃣ Save to PostgreSQL
    try {
      await pool.query(
        `INSERT INTO contacts (name, email, phone, message, created_at) 
         VALUES ($1, $2, $3, $4, $5)`,
        [name, email, phone || "", message, contactTimestamp]
      );
      console.log("✅ Contact saved to PostgreSQL");
    } catch (dbErr) {
      console.error("❌ DB Insert Error:", dbErr);
    }

    // 2️⃣ Send to Brevo
    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": process.env.BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email,
        attributes: {
          NAME: name,
          PHONE: phone || "",
          MESSAGE: message,
          TIMESTAMP: contactTimestamp,
        },
        listIds: [5],   // 👈 your Brevo list ID
        updateEnabled: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Brevo API Error:", data);
      return res.status(response.status).json({
        success: false,
        error: data.message || "Failed to add contact to Brevo",
      });
    }

    res.json({ success: true, data });
  } catch (err) {
    console.error("Server Error:", err);
    res.status(500).json({
      success: false,
      error: "Internal Server Error. Please try again later.",
    });
  }
});

// =======================
// 🔐 Admin Auth
// =======================
app.use("/api/auth", authRoutes);

// Health check
app.get("/", (req, res) => {
  res.send("✅ Backend is running: Contact API + Admin Auth API ready!");
});

// =======================
// 🚀 Start server
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export { pool }; // export pool if needed in other files
