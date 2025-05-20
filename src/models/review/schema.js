const mongoose = require("mongoose");
const { Schema } = mongoose;

// Định nghĩa schema cho đánh giá (review)
const ReviewSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    orderItem: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    // Lưu thông tin sản phẩm tại thời điểm đánh giá (phòng trường hợp sản phẩm thay đổi)
    productSnapshot: {
      productId: mongoose.Schema.Types.ObjectId, // ID sản phẩm để tham chiếu nếu cần
      variantId: mongoose.Schema.Types.ObjectId, // ID biến thể để tham chiếu nếu cần
      orderId: mongoose.Schema.Types.ObjectId, // ID đơn hàng để tham chiếu nếu cần
      name: String,
      variantName: String,
      sizeName: String,
      image: String,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Đảm bảo mỗi sản phẩm trong đơn hàng chỉ được đánh giá một lần
ReviewSchema.index({ user: 1, orderItem: 1 }, { unique: true });

// Thêm các virtual fields để dễ dàng tham chiếu khi cần
ReviewSchema.virtual("product", {
  ref: "Product",
  localField: "productSnapshot.productId",
  foreignField: "_id",
  justOne: true,
});

ReviewSchema.virtual("variant", {
  ref: "Variant",
  localField: "productSnapshot.variantId",
  foreignField: "_id",
  justOne: true,
});

ReviewSchema.virtual("order", {
  ref: "Order",
  localField: "productSnapshot.orderId",
  foreignField: "_id",
  justOne: true,
});

module.exports = ReviewSchema;
