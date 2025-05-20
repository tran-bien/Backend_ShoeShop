const mongoose = require("mongoose");

/**
 * Áp dụng middleware cho Review Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Sau khi tạo hoặc cập nhật đánh giá, cập nhật rating trung bình cho sản phẩm
  const updateProductRating = async function (productId) {
    const Product = mongoose.model("Product");
    const Review = mongoose.model("Review");

    // Tính trung bình đánh giá
    const stats = await Review.aggregate([
      {
        $match: {
          "productSnapshot.productId": productId,
          isActive: true,
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          numReviews: { $sum: 1 },
        },
      },
    ]);

    // Cập nhật sản phẩm
    if (stats.length > 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: Math.round(stats[0].avgRating * 10) / 10,
        numReviews: stats[0].numReviews,
      });
    } else {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        numReviews: 0,
      });
    }
  };

  // Sau khi lưu đánh giá
  schema.post("save", async function () {
    await updateProductRating(this.productSnapshot.productId);
  });

  // Sau khi cập nhật đánh giá
  schema.post("findOneAndUpdate", async function (doc) {
    if (doc && doc.productSnapshot && doc.productSnapshot.productId) {
      await updateProductRating(doc.productSnapshot.productId);
    }
  });

  // Trước khi xóa đánh giá
  schema.pre(
    "deleteOne",
    { document: true, query: false },
    async function (next) {
      // Lưu id sản phẩm để cập nhật sau khi xóa
      this._productId = this.productSnapshot.productId;

      next();
    }
  );

  // Sau khi xóa đánh giá
  schema.post("deleteOne", { document: true, query: false }, async function () {
    if (this._productId) {
      await updateProductRating(this._productId);
    }
  });

  // Xử lý cho deleteMany
  schema.pre("deleteMany", async function (next) {
    try {
      // Lấy danh sách review bị ảnh hưởng để xóa ảnh và cập nhật rating
      const reviews = await this.model.find(this.getFilter());

      // Lưu thông tin để xử lý sau khi xóa
      this._reviews = reviews;
      this._productIds = reviews
        .map((review) =>
          review.productSnapshot && review.productSnapshot.productId
            ? review.productSnapshot.productId.toString()
            : null
        )
        .filter((id) => id !== null);

      next();
    } catch (error) {
      next(error);
    }
  });

  schema.post("deleteMany", async function () {
    // Cập nhật tất cả sản phẩm bị ảnh hưởng
    if (this._productIds && this._productIds.length > 0) {
      for (const productId of this._productIds) {
        await updateProductRating(productId);
      }
    }
  });
};

module.exports = { applyMiddlewares };
