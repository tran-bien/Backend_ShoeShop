const mongoose = require("mongoose");

const SizeSchema = new mongoose.Schema(
  {
    value: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Size = mongoose.model("Size", SizeSchema);

module.exports = Size;
