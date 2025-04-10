const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    cartItems: [
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
          default: 1,
          min: 1,
          validate: {
            validator: Number.isInteger,
            message: "Số lượng phải là số nguyên",
          },
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        // Lưu thông tin để hiển thị trên giỏ hàng mà không cần joins
        productName: {
          type: String,
        },
        variantName: {
          type: String,
        },
        sizeName: {
          type: String,
        },
        image: {
          type: String,
        },
        isAvailable: {
          type: Boolean,
          default: true,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
    },
    couponData: {
      code: String,
      discountType: {
        type: String,
        enum: ["fixed", "percent"],
      },
      discountValue: Number,
      maxDiscountAmount: Number,
    },
    totalItems: {
      type: Number,
      default: 0,
    },
    subTotal: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = CartSchema;
