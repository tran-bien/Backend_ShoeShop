const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema(
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
      default: 0,
      min: 0,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    averageCostPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Index để tìm kiếm nhanh
inventoryItemSchema.index(
  { product: 1, variant: 1, size: 1 },
  { unique: true }
);
inventoryItemSchema.index({ quantity: 1 });

// Virtual để kiểm tra cảnh báo hết hàng
inventoryItemSchema.virtual("isLowStock").get(function () {
  return this.quantity <= this.lowStockThreshold;
});

inventoryItemSchema.virtual("isOutOfStock").get(function () {
  return this.quantity === 0;
});

// Đảm bảo virtuals được include khi convert to JSON
inventoryItemSchema.set("toJSON", { virtuals: true });
inventoryItemSchema.set("toObject", { virtuals: true });

module.exports = inventoryItemSchema;
