const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
    },
    images: {
      type: [String],
      default: [],
    },
    isVerified: {
      type: Boolean,
      default: true,
    },
    likes: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "hidden", "deleted"],
      default: "active",
    },
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
  },
  {
    timestamps: true,
  }
);

// Cập nhật xếp hạng trung bình cho sản phẩm khi thêm đánh giá mới
ReviewSchema.post("save", async function () {
  const Product = mongoose.model("Product");

  const avgRating = await mongoose
    .model("Review")
    .aggregate([
      { $match: { productId: this.productId, status: "active" } },
      { $group: { _id: null, avg: { $avg: "$rating" } } },
    ]);

  if (avgRating.length > 0) {
    await Product.findByIdAndUpdate(this.productId, {
      rating: avgRating[0].avg,
    });
  }
});

const Review = mongoose.model("Review", ReviewSchema);

module.exports = Review;
