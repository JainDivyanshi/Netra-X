const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./route/auth.routes");
const componentRoutes = require("./route/components.routes");
const matchRoutes = require("./route/match.routes");
const { connectDB } = require("./db/connect");

const app = express();

connectDB();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  credentials: true
}));

app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "netrax-node-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/components", componentRoutes);
app.use("/api", matchRoutes);

module.exports = app;
