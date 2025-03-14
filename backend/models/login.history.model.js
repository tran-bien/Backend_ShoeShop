const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.status === "success"; // Chỉ bắt buộc khi đăng nhập thành công
      },
    },
    email: {
      type: String,
      required: function () {
        return this.status === "failed"; // Bắt buộc khi đăng nhập thất bại
      },
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      default: "success",
    },
    reason: {
      type: String,
      default: null,
    },
    ipAddress: {
      type: String,
      default: "Unknown",
    },
    userAgent: {
      type: String,
      default: "Unknown",
    },
    loginTime: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const LoginHistory = mongoose.model("LoginHistory", loginHistorySchema);
module.exports = LoginHistory;
