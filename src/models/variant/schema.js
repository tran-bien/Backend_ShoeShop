const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Sản phẩm là bắt buộc"],
    },
    imagesvariant: [
      {
        url: {
          type: String,
        },
        public_id: {
          type: String,
        },
        isMain: {
          type: Boolean,
          default: false,
        },
        displayOrder: {
          type: Number,
          default: 0,
        },
      },
    ],
    // XÓA: price, costPrice, percentDiscount, priceFinal, profit, profitPercentage
    // Các thông tin giá và lợi nhuận giờ được quản lý qua InventoryItem và InventoryTransaction
    gender: {
      type: String,
      enum: ["male", "female", "unisex"],
      default: "unisex",
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: [true, "Màu sắc là bắt buộc"],
    },
    sizes: [
      {
        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
          required: true,
        },
        sku: {
          type: String,
          unique: true,
          sparse: true, // Cho phép nhiều document không có SKU
        },
        // sku để tracking và quản lý kho
        // ĐÃ XÓA: quantity, isSizeAvailable
        // Số lượng giờ được quản lý qua InventoryItem
      },
    ],
    isActive: {
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

module.exports = VariantSchema;
