const mongoose = require("mongoose");

const SizeSchema = new mongoose.Schema(
  {
    value: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    // Thêm trường cho xóa mềm
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

SizeSchema.index({ value: 1 });
SizeSchema.index({ deletedAt: 1 });

module.exports = SizeSchema;
