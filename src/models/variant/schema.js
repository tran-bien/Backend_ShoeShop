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
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    percentDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
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
    profit: {
      type: Number,
      default: function () {
        const finalPrice =
          this.percentDiscount > 0
            ? this.price - (this.price * this.percentDiscount) / 100
            : this.price;
        return finalPrice - this.costPrice;
      },
    },
    profitPercentage: {
      type: Number,
      default: function () {
        const finalPrice =
          this.percentDiscount > 0
            ? this.price - (this.price * this.percentDiscount) / 100
            : this.price;
        return this.costPrice
          ? ((finalPrice - this.costPrice) / this.costPrice) * 100
          : 0;
      },
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
    },
    sizes: [
      {
        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 0,
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
