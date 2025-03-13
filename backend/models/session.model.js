const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      required: true,
    },
    ip: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tìm kiếm nhanh
SessionSchema.index({ token: 1 });
SessionSchema.index({ userId: 1 });
SessionSchema.index({ expiresAt: 1 });
SessionSchema.index({ isActive: 1 });

// Phương thức tĩnh để dọn dẹp session hết hạn
SessionSchema.statics.cleanExpiredSessions = async function () {
  const now = new Date();
  const result = await this.updateMany(
    { expiresAt: { $lt: now }, isActive: true },
    { isActive: false }
  );

  console.log(`Đã dọn dẹp ${result.modifiedCount} session hết hạn`);
  return result;
};

const Session = mongoose.model("Session", SessionSchema);

module.exports = Session;
