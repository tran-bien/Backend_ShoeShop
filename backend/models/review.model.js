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
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
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
        type: String,
        validate: {
          validator: function (v) {
            return /^https?:\/\//.test(v);
          },
          message: (props) => `${props.value} không phải là URL hợp lệ!`,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    adminReply: {
      type: String,
      maxlength: [500, "Phản hồi không được vượt quá 500 ký tự"],
    },
    adminReplyDate: {
      type: Date,
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
  { timestamps: true }
);

// Index cho hiệu suất truy vấn
ReviewSchema.index({ product: 1, createdAt: -1 });
ReviewSchema.index({ user: 1, createdAt: -1 });
ReviewSchema.index({ rating: 1 });

// Virtual field cho số lượng likes
ReviewSchema.virtual("likeCount").get(function () {
  return this.likes.length;
});

// Phương thức để kiểm tra xem user có like review này chưa
ReviewSchema.methods.isLikedByUser = function (userId) {
  return this.likes.some((id) => id.toString() === userId.toString());
};

// Middleware trước khi lưu đánh giá
ReviewSchema.pre("save", async function (next) {
  if (this.isNew && this.order) {
    // Kiểm tra xem đơn hàng có tồn tại và thuộc về người dùng hiện tại không
    const Order = mongoose.model("Order");
    const order = await Order.findOne({
      _id: this.order,
      user: this.user,
      "orderItems.product": this.product,
      status: "delivered",
    });

    if (order) {
      this.isVerifiedPurchase = true;
    }
  }
  next();
});

// Cập nhật rating trung bình của sản phẩm sau khi lưu/xóa đánh giá
async function updateProductRating(productId) {
  const Review = mongoose.model("Review");
  const Product = mongoose.model("Product");

  const stats = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        averageRating: { $avg: "$rating" },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  let averageRating = 0;
  let numReviews = 0;

  if (stats.length > 0) {
    averageRating = stats[0].averageRating;
    numReviews = stats[0].numReviews;
  }

  await Product.findByIdAndUpdate(productId, {
    rating: averageRating,
    numReviews: numReviews,
  });
}

// Cập nhật rating sau khi lưu
ReviewSchema.post("save", function () {
  updateProductRating(this.product);
});

// Cập nhật rating sau khi xóa
ReviewSchema.post("remove", function () {
  updateProductRating(this.product);
});

const Review = mongoose.model("Review", ReviewSchema);

module.exports = Review;
