const mongoose = require("mongoose");

const ComponentSchema = new mongoose.Schema({
  type: { type: String, required: true, index: true },
  tags: [{ type: String, index: true }],
  title: { type: String, required: true },
  image_url: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Component", ComponentSchema);
