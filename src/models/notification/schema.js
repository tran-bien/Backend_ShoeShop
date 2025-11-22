const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "ORDER_CONFIRMED",
        "ORDER_SHIPPING",
        "ORDER_DELIVERED",
        "ORDER_CANCELLED",
        "RETURN_APPROVED",
        "RETURN_REJECTED",
        "RETURN_COMPLETED",
        "LOYALTY_TIER_UP",
        "POINTS_EARNED",
        "POINTS_EXPIRE_SOON",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      maxlength: 200,
    },

    message: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    // Data động cho template
    data: mongoose.Schema.Types.Mixed,

    // Link hành động
    actionUrl: {
      type: String,
      maxlength: 500,
    },

    actionText: {
      type: String,
      maxlength: 100,
    },

    // Trạng thái
    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
    },

    // Channels
    channels: {
      inApp: {
        type: Boolean,
        default: true,
      },
      email: {
        type: Boolean,
        default: false,
      },
      push: {
        type: Boolean,
        default: false,
      },
    },

    // Email tracking
    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
    },

    emailError: {
      type: String,
    },

    // Idempotency key để tránh tạo trùng
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    // References
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },

    returnRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReturnRequest",
    },

    // TTL - Tự động xóa sau 90 ngày
    // FIXED Bug #2: Dùng expireAt field riêng thay vì createdAt với expires
    expireAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      index: { expires: 0 }, // TTL index
    },
  },
  {
    timestamps: true, // An toàn khi dùng expireAt riêng
  }
);

// Index
NotificationSchema.index({ user: 1, createdAt: -1 });
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ type: 1, createdAt: -1 });

module.exports = NotificationSchema;
