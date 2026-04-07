const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

function signToken(user) {
  return jwt.sign(
    { user_id: user._id, email: user.email, name: user.name },
    process.env.JWT_SECRET || "netrax_secret",
    { expiresIn: "7d" }
  );
}

function setAuthCookie(res, token) {
  const isProd = process.env.NODE_ENV === "production";

  res.cookie("authtoken", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}


async function register(req, res) {
  /*
    EXPECTED REQUEST FROM FRONTEND:
    POST /api/auth/register
    Content-Type: application/json

    Body:
    {
      "name": "Officer 1",
      "email": "officer1@netrax.com",
      "password": "StrongPass123"
    }

    RESPONSE:
    201 Created
    {
      "message": "Registered successfully",
      "token": "<jwt>",
      "user": { "id": "...", "name": "...", "email": "..." }

      Changed, now sending cookie
    }

    NOTE: PRD says "no verification/confirmation" :contentReference[oaicite:2]{index=2}
  */

  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, password required" });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ error: "Email already exists" });

  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password_hash });

  const token = signToken(user);

  setAuthCookie(res, token);

  res.status(201).json({
    message: "Registered successfully",
    user: { id: user._id, name: user.name, email: user.email }
  });

}

async function login(req, res) {
  /*
    EXPECTED REQUEST FROM FRONTEND:
    POST /api/auth/login
    Body:
    { "email": "...", "password": "..." }

    RESPONSE:
    {
      "message": "Login success",
      "token": "<jwt>",
      "user": { "id": "...", "name": "...", "email": "..." }

      changed, now checking cookie
    }
  */

  const { email, password } = req.body;

  if (!email || !password) return res.status(400).json({ error: "email and password required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken(user);

  setAuthCookie(res, token);

  res.json({
    message: "Login success",
    user: { id: user._id, name: user.name, email: user.email }
  });

}

async function logout(req, res) {
  const isProd = process.env.NODE_ENV === "production";

  res.clearCookie("authtoken", {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax"
  });

  res.json({ message: "Logged out" });
}

async function me(req, res) {
  res.json({ user: req.user });
}

module.exports = { register, login, logout, me };
