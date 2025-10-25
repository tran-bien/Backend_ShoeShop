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
      default: true,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // COUPON NÂNG CAO - Áp dụng cho sản phẩm/variant/category cụ thể
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    applicableVariants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
      },
    ],

    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // Scope của coupon
    scope: {
      type: String,
      enum: ["ALL", "PRODUCTS", "VARIANTS", "CATEGORIES"],
      default: "ALL",
    },

    // Điều kiện nâng cao
    conditions: {
      minQuantity: {
        type: Number,
        min: 0,
        comment: "Số lượng sản phẩm tối thiểu",
      },

      maxUsagePerUser: {
        type: Number,
        min: 0,
        comment: "Giới hạn số lần dùng/user",
      },

      requiredTiers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "LoyaltyTier",
        },
      ],

      firstOrderOnly: {
        type: Boolean,
        default: false,
        comment: "Chỉ cho đơn hàng đầu tiên",
      },

      requiredTotalSpent: {
        type: Number,
        min: 0,
        comment: "Yêu cầu đã mua tối thiểu bao nhiêu tiền",
      },
    },

    // Usage tracking per user
    userUsage: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        usageCount: {
          type: Number,
          default: 0,
        },
        lastUsedAt: Date,
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
