const mongoose = require("mongoose");

const ColorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên màu sắc là bắt buộc"],
      trim: true,
      maxlength: [50, "Tên màu sắc không được vượt quá 50 ký tự"],
    },
    hexCode: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Color = mongoose.model("Color", ColorSchema);

module.exports = Color;
