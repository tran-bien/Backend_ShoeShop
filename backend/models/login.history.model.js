const mongoose = require("mongoose");

const LoginHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
    device: {
      type: String,
    },
    browser: {
      type: String,
    },
    location: {
      type: String,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
    },
    reason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const LoginHistory = mongoose.model("LoginHistory", LoginHistorySchema);

module.exports = LoginHistory;
