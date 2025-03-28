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

module.exports = SizeSchema;
