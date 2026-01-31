const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.log("Warning: MONGO_URI missing, DB not connected.");
    return;
  }

  try {
    await mongoose.connect(uri);
    console.log("MongoDB connected");
  } catch (err) {
    console.log("MongoDB connection failed:", err.message);
  }
}

module.exports = { connectDB };