const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên sản phẩm là bắt buộc"],
      trim: true,
      maxlength: [1000, "Tên sản phẩm không được vượt quá 1000 ký tự"],
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      required: [true, "Mô tả sản phẩm là bắt buộc"],
      maxlength: [1000, "Mô tả sản phẩm không được vượt quá 1000 ký tự"],
    },
    images: [
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
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Danh mục sản phẩm là bắt buộc"],
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: [true, "Thương hiệu sản phẩm là bắt buộc"],
    },
    variants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
      },
    ],
    totalQuantity: {
      type: Number,
      default: 0,
    },
    stockStatus: {
      type: String,
      enum: ["in_stock", "low_stock", "out_of_stock"],
      default: "out_of_stock",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    numReviews: {
      type: Number,
      default: 0,
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

module.exports = ProductSchema;
