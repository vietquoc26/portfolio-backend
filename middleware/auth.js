// middleware/auth.js
import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  const token = req.cookies?.aid;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, username }
    next();
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
