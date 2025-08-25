// hash.js
import bcrypt from "bcryptjs";

const run = async () => {
  const plainPassword = "Giadinhlaso1!?";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);
  console.log("Your hashed password:", hash);
};

run();
