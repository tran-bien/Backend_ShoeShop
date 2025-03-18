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
  },
  {
    timestamps: true,
  }
);

module.exports = SizeSchema;
