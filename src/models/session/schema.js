const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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
      default: "Unknown",
    },
    ip: {
      type: String,
      default: "Unknown",
    },
    device: {
      type: Object,
      default: {},
    },
    expiresAt: {
      type: Date,
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
  },
  {
    timestamps: true,
  }
);

// Middleware-based cleanup: Auto-delete expired sessions on query
// Thay thế setInterval bằng lazy evaluation
SessionSchema.pre(/^find/, async function (next) {
  try {
    const now = new Date();

    // Xóa sessions hết hạn
    const expiredResult = await this.model.deleteMany({
      expiresAt: { $lte: now },
    });

    // Xóa sessions không hoạt động > 2 ngày
    const TWO_DAYS_AGO = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const inactiveResult = await this.model.deleteMany({
      isActive: false,
      updatedAt: { $lte: TWO_DAYS_AGO },
    });

    if (expiredResult.deletedCount > 0 || inactiveResult.deletedCount > 0) {
      console.log(
        `[AUTO-CLEANUP] Deleted ${expiredResult.deletedCount} expired, ` +
          `${inactiveResult.deletedCount} inactive sessions`
      );
    }
  } catch (error) {
    console.error("[AUTO-CLEANUP] Session cleanup error:", error.message);
  }

  next();
});

module.exports = SessionSchema;
