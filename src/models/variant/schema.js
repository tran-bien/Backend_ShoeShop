const mongoose = require("mongoose");

const VariantSchema = new mongoose.Schema(
  {
    imagesvariant: [
      {
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
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
    price: {
      type: Number,
      required: [true, "Giá bán sản phẩm là bắt buộc"],
      min: [0, "Giá bán sản phẩm không được âm"],
    },
    costPrice: {
      type: Number,
      required: [true, "Vui lòng nhập giá gốc sản phẩm"],
      min: [0, "Giá gốc sản phẩm không được âm"],
      validate: {
        validator: function (value) {
          return value <= this.price;
        },
        message: "Giá gốc không được lớn hơn giá bán",
      },
    },
    profit: {
      type: Number,
      default: function () {
        return this.price - this.costPrice;
      },
    },
    profitPercentage: {
      type: Number,
      default: function () {
        return ((this.price - this.costPrice) / this.costPrice) * 100;
      },
    },
    percentDiscount: {
      type: Number,
      default: 0,
      min: [0, "Phần trăm giảm giá không được âm"],
      max: [100, "Phần trăm giảm giá không được vượt quá 100%"],
    },
    priceFinal: {
      type: Number,
      default: function () {
        return this.percentDiscount > 0
          ? this.price - (this.price * this.percentDiscount) / 100
          : this.price;
      },
      min: 0,
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
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
          required: [true, "Kích thước là bắt buộc"],
        },
        quantity: {
          type: Number,
          required: [true, "Số lượng là bắt buộc"],
          min: [0, "Số lượng không được âm"],
          default: 0,
        },
        sku: {
          type: String,
          unique: true,
        },
        isSizeAvailable: {
          type: Boolean,
          default: function () {
            return this.quantity > 0;
          },
        },
      },
    ],
    variantStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
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

VariantSchema.index({ imagesvariant: 1 });
VariantSchema.index({ price: 1 });
VariantSchema.index({ costPrice: 1 });
VariantSchema.index({ profit: 1 });
VariantSchema.index({ profitPercentage: 1 });
VariantSchema.index({ percentDiscount: 1 });
VariantSchema.index({ gender: 1 });
VariantSchema.index({ color: 1 });
VariantSchema.index({ sizes: 1 });
VariantSchema.index({ variantStatus: 1 });
VariantSchema.index({ deletedAt: 1 });

module.exports = VariantSchema;
