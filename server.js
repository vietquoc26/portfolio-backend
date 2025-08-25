// server.js
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// 🛡️ Middleware
// =======================
app.use(helmet());
app.use(cors({
  origin: "https://www.vietportfolio.work.gd",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// =======================
// 🗄️ Supabase Connection (Admin Auth only)
// =======================
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// =======================
// 📧 Brevo Mailer
// =======================
async function sendEmail(to, subject, text) {
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { name: "VietPortfolio", email: "no-reply@vietportfolio.com" },
        to: [{ email: to }],
        subject,
        textContent: text,
      }),
    });

    const data = await response.json();
    console.log("📧 Email sent:", data);
    return data;
  } catch (err) {
    console.error("❌ Error sending email:", err.message);
  }
}

// =======================
// 📩 Contact Form Route
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

    // Send to Brevo
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
        listIds: [4],
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
// 🔑 Admin Auth Routes (Supabase)
// =======================

// Register Admin
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, role = "admin" } = req.body;

  try {
    const { data: existingUser } = await supabase
      .from("admins")
      .select("*")
      .eq("username", username)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    await supabase.from("admins").insert([
      { username, email, password: hashedPassword, role },
    ]);

    res.status(201).json({ message: "✅ Admin registered successfully" });
  } catch (err) {
    console.error("❌ Register error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Login Admin
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcryptjs.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username, role: admin.role || "admin" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token, user: { id: admin.id, username: admin.username, role: admin.role } });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify JWT
app.get("/api/auth/verify", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, user: decoded });
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
});

// Forgot Password
app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const { data: admin } = await supabase
      .from("admins")
      .select("*")
      .eq("email", email)
      .single();

    if (!admin) return res.status(404).json({ message: "User not found" });

    const resetToken = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    await sendEmail(
      email,
      "Password Reset",
      `Click the link to reset your password: https://yourfrontend.com/reset?token=${resetToken}`
    );

    res.json({ message: "Password reset email sent" });
  } catch (err) {
    console.error("❌ Forgot-password error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

// =======================
// 📌 Base Route
// =======================
app.get("/", (req, res) => {
  res.send("✅ Backend is running: Brevo Contact + Supabase Admin Auth ready!");
});

// =======================
// 🚦 Start Server
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
