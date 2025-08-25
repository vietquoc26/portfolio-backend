// create-admin.js
import dotenv from "dotenv";
import bcryptjs from "bcryptjs";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 👇 Replace these with your desired admin credentials
const username = "admin";
const email = "vietquoc150799@gmail.com";
const password = "Giadinhlaso1@@@";

async function createAdmin() {
  try {
    // Check if the username already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from("admins")
      .select("*")
      .eq("username", username)
      .single();

    if (existingUser) {
      console.log("⚠️ Admin already exists:", username);
      return;
    }

    // Hash the password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Insert admin
    const { data, error } = await supabase.from("admins").insert([
      { username, email, password: hashedPassword, role: "admin" },
    ]);

    if (error) {
      console.error("❌ Error inserting admin:", error);
    } else {
      console.log("✅ Admin created successfully:", username);
    }
  } catch (err) {
    console.error("❌ Unexpected error:", err.message);
  }
}

createAdmin();
