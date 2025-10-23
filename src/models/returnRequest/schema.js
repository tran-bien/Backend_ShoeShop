const mongoose = require("mongoose");

const returnRequestSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["RETURN", "EXCHANGE"],
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          required: true,
        },
        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        priceAtPurchase: {
          type: Number,
          required: true,
        },
        // Chỉ dành cho EXCHANGE
        exchangeToVariant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
        },
        exchangeToSize: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
        },
      },
    ],
    reason: {
      type: String,
      enum: [
        "wrong_size",
        "wrong_product",
        "defective",
        "not_as_described",
        "changed_mind",
        "other",
      ],
      required: true,
    },
    reasonDetail: {
      type: String,
      trim: true,
    },
    images: [
      {
        type: String,
      },
    ],
    // Phương thức hoàn tiền (chỉ cho RETURN)
    refundMethod: {
      type: String,
      enum: ["original_payment", "store_credit", "bank_transfer"],
    },
    refundAmount: {
      type: Number,
      min: 0,
    },
    // Thông tin chuyển khoản (nếu bank_transfer)
    bankInfo: {
      bankName: String,
      accountNumber: String,
      accountName: String,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "processing",
        "completed",
        "rejected",
        "canceled",
      ],
      default: "pending",
    },
    // Tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: Date,
    completedAt: Date,
    rejectionReason: String,
    staffNotes: String,
  },
  {
    timestamps: true,
  }
);

// Index
returnRequestSchema.index({ order: 1 });
returnRequestSchema.index({ customer: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
// ✅ ADDED: Compound index để optimize duplicate exchange request check
returnRequestSchema.index({
  order: 1,
  type: 1,
  status: 1,
  "items.variant": 1,
  "items.size": 1,
});

module.exports = returnRequestSchema;
