const express = require("express");
const cors = require("cors");

const authRoutes = require("./route/auth.routes");
const componentRoutes = require("./route/components.routes");
const matchRoutes = require("./route/match.routes");

const { connectDB } = require("./db/connect");

const app = express();

connectDB();

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || "*",
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "netrax-node-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/components", componentRoutes);
app.use("/api", matchRoutes);

module.exports = app;