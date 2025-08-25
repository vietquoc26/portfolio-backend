// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// =======================
// 🛡️ Middleware
// =======================
app.use(helmet());
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());
app.use(cookieParser());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
});
app.use(limiter);

// =======================
// 🗄️ Supabase Connection
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
// 🔑 Auth Routes
// =======================

// Register Admin
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password, role = "admin" } = req.body;

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("admins")
      .select("*")
      .eq("username", username)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Insert into Supabase
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

    res.json({ token });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ message: "Server error" });
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

    if (!admin) {
      return res.status(404).json({ message: "User not found" });
    }

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
  res.send("🚀 VietPortfolio Backend is running");
});

// =======================
// 🚦 Start Server
// =======================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});