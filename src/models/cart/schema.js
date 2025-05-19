const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cartItems: [
      {
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
          default: 1,
        },
        price: {
          type: Number,
          required: true,
        },
        // Thông tin bổ sung để hiển thị - chỉ cache name và image
        productName: {
          type: String,
          required: true,
        },
        image: {
          type: String,
          default: "",
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
    // Thông tin mã giảm giá
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    // Thông tin mã giảm giá (lưu trữ để tránh liên kết)
    couponData: {
      code: String,
      type: {
        type: String,
        enum: ["percent", "fixed"],
      },
      value: Number,
      maxDiscount: Number,
    },
    // Tổng số sản phẩm trong giỏ hàng
    totalItems: {
      type: Number,
      default: 0,
    },
    // Tổng giá trị sản phẩm
    subTotal: {
      type: Number,
      default: 0,
    },
    // Giá trị giảm giá
    discount: {
      type: Number,
      default: 0,
    },
    // Tổng giá trị sau giảm giá
    totalPrice: {
      type: Number,
      default: 0,
    },
    // Thời gian cập nhật cuối cùng
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = CartSchema;