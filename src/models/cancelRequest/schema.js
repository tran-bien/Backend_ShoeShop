const mongoose = require("mongoose");

const CancelRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: [true, "Lý do hủy đơn là bắt buộc"],
      maxlength: [500, "Lý do không được vượt quá 500 ký tự"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminResponse: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

CancelRequestSchema.index({ order: 1 });
CancelRequestSchema.index({ userId: 1, deletedAt: 1 });
CancelRequestSchema.index({ status: 1, deletedAt: 1 });
CancelRequestSchema.index({ createdAt: -1, deletedAt: 1 });
CancelRequestSchema.index({ deletedAt: 1 });

module.exports = CancelRequestSchema;
