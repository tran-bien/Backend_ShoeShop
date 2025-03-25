const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Mã giảm giá là bắt buộc"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ["percent", "fixed"],
      required: [true, "Loại giảm giá là bắt buộc"],
    },
    discountValue: {
      type: Number,
      required: [true, "Giá trị giảm giá là bắt buộc"],
      min: [0, "Giá trị giảm giá không được âm"],
    },
    maxDiscount: {
      type: Number,
      min: [0, "Giảm giá tối đa không được âm"],
    },
    minimumPurchase: {
      type: Number,
      min: [0, "Giá trị đơn hàng tối thiểu không được âm"],
      default: 0,
    },
    description: String,
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: [true, "Ngày hết hạn là bắt buộc"],
    },
    usageLimit: {
      type: Number,
      min: [0, "Giới hạn sử dụng không được âm"],
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isValid: {
      type: Boolean,
      default: true,
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

module.exports = CouponSchema;
