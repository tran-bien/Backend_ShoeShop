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
        color: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Color",
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
          min: [1, "Số lượng phải ít nhất là 1"],
          validate: {
            validator: Number.isInteger,
            message: "Số lượng phải là số nguyên",
          },
        },
        price: {
          type: Number,
          required: true,
          min: [0, "Giá sản phẩm không được âm"],
        },
      },
    ],
    totalItems: {
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

CartSchema.index({ user: 1 });
CartSchema.index({ "cartItems.product": 1 });
CartSchema.index({ "cartItems.variant": 1 });
CartSchema.index({ "cartItems.color": 1 });
CartSchema.index({ "cartItems.size": 1 });
CartSchema.index({ totalItems: 1 });
CartSchema.index({ totalPrice: 1 });

module.exports = CartSchema;
