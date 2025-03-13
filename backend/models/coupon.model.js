const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const CouponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: [0, "Giá trị giảm giá không được âm"],
    },
    maxDiscountAmount: {
      type: Number,
      min: [0, "Giá trị giảm giá tối đa không được âm"],
    },
    minOrderValue: {
      type: Number,
      min: [0, "Giá trị đơn hàng tối thiểu không được âm"],
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    usedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    description: String,
  },
  {
    timestamps: true,
  }
);

// Thêm plugin paginate
CouponSchema.plugin(mongoosePaginate);

const Coupon = mongoose.model("Coupon", CouponSchema);

module.exports = Coupon;
