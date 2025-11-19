const mongoose = require("mongoose");

const ViewHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    sessionId: {
      type: String,
      comment: "Cho anonymous users chưa đăng nhập",
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
    },

    // Denormalized data cho performance
    productName: String,
    productImage: String,
    productPrice: Number,

    viewDuration: {
      type: Number,
      default: 0,
      comment: "Thời gian xem (giây)",
    },

    source: {
      type: String,
      enum: ["SEARCH", "CATEGORY", "RECOMMENDATION", "DIRECT", "RELATED"],
      default: "DIRECT",
    },

    deviceInfo: {
      type: String,
      comment: "Browser/device info",
    },

    // TTL - Tự động xóa sau 30 ngày
    // Dùng expireAt field riêng thay vì createdAt với expires
    expireAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      index: { expires: 0 }, // TTL index
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Chỉ dùng createdAt
  }
);

// Compound index
ViewHistorySchema.index({ user: 1, product: 1, createdAt: -1 });
ViewHistorySchema.index({ sessionId: 1, createdAt: -1 });
ViewHistorySchema.index({ createdAt: -1 }); // TTL index

module.exports = ViewHistorySchema;
