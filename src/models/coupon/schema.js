const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["percent", "fixed"],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      min: 0,
    },
    minOrderValue: {
      type: Number,
      min: 0,
      default: 0,
    },
    startDate: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    maxUses: {
      type: Number,
      min: 0,
    },
    currentUses: {
      type: Number,
      default: 0,
    },
    // Thay isActive bằng status chi tiết hơn
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "archived"],
      default: "active",
    },
    isPublic: {
      type: Boolean,
      default: true, // true: hiển thị cho tất cả, false: chỉ cho người dùng đã thu thập
    },
    users: [
      {
        // Danh sách người dùng đã thu thập mã
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    applyFor: {
      type: String,
      enum: ["all", "categories", "products"],
      default: "all",
    },
    categoryIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = CouponSchema;
