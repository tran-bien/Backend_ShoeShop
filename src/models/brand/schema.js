const mongoose = require("mongoose");

const BrandSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tên thương hiệu là bắt buộc"],
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      maxlength: [1000, "Mô tả không được vượt quá 1000 ký tự"],
    },
    logo: {
      url: String,
      public_id: String,
    },
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

BrandSchema.index({ name: 1 });
BrandSchema.index({ slug: 1 });
BrandSchema.index({ isActive: 1 });
BrandSchema.index({ deletedAt: 1 });

module.exports = BrandSchema;
