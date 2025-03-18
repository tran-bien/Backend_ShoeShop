const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Người đánh giá là bắt buộc"],
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Sản phẩm là bắt buộc"],
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
      required: [true, "Biến thể là bắt buộc"],
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Đơn hàng là bắt buộc"],
    },
    rating: {
      type: Number,
      required: [true, "Đánh giá sao là bắt buộc"],
      min: [1, "Đánh giá tối thiểu là 1 sao"],
      max: [5, "Đánh giá tối đa là 5 sao"],
    },
    content: {
      type: String,
      maxlength: [1000, "Nội dung không được vượt quá 1000 ký tự"],
    },
    images: [
      {
        url: String,
        public_id: String,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    likes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isVerifiedPurchase: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field cho số lượng likes
ReviewSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

module.exports = ReviewSchema;
