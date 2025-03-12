const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    deviceInfo: {
      deviceName: { type: String },
      deviceType: { type: String }, // mobile, tablet, desktop
      browser: { type: String },
      os: { type: String },
      ipAddress: { type: String },
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
    isActive: {
      type: Boolean,
      default: true,
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
