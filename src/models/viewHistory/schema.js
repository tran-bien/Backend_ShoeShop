const mongoose = require("mongoose");

const ViewHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    sessionId: {
      type: String,
      index: true,
      comment: "Cho anonymous users chưa đăng nhập",
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
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
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 2592000, // 30 ngày = 30 * 24 * 60 * 60
    },
  },
  {
    timestamps: false, // Chỉ dùng createdAt với TTL
  }
);

// Compound index
ViewHistorySchema.index({ user: 1, product: 1, createdAt: -1 });
ViewHistorySchema.index({ sessionId: 1, createdAt: -1 });
ViewHistorySchema.index({ createdAt: -1 }); // TTL index

module.exports = ViewHistorySchema;

