const mongoose = require("mongoose");

const ColorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên màu là bắt buộc"],
      trim: true,
      unique: true,
    },
    code: {
      type: String, // mã màu hex
      default: null,
    },
    colors: { type: [String], default: [] }, // Mảng chứa 2 màu nếu là half
    type: { type: String, enum: ["solid", "half"], required: true }, // solid hoặc half
  },
  {
    timestamps: true,
  }
);

module.exports = ColorSchema;
