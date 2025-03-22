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
        "order",
        "coupon",
        "product",
        "review",
        "user",
        "cancelRequest",
        "other",
      ],
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "onModel",
    },
    onModel: {
      type: String,
      enum: ["Order", "Review", "Coupon", "Product", "User", "CancelRequest"],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isImportant: {
      type: Boolean,
      default: false,
    },
    markedForDeletion: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: function () {
        const date = new Date();
        date.setDate(date.getDate() + 30);
        return date;
      },
    },
  },
  {
    timestamps: true,
  }
);

// Thêm index cho các trường thường truy vấn để tối ưu hiệu suất
NotificationSchema.index({ user: 1, isRead: 1 });
NotificationSchema.index({ user: 1, type: 1 });
NotificationSchema.index({ user: 1, createdAt: -1 }); // Để sắp xếp theo thời gian
NotificationSchema.index({ markedForDeletion: 1, createdAt: 1 }); // Để xóa hàng loạt

// Thiết lập TTL index để tự động xóa thông báo quá hạn
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = NotificationSchema;
