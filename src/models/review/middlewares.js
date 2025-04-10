const mongoose = require("mongoose");

/**
 * Cập nhật rating trung bình của sản phẩm
 * @param {string} productId - ID của sản phẩm
 */
async function updateProductRating(productId) {
  try {
    const Review = mongoose.model("Review");
    const Product = mongoose.model("Product");
    const Variant = mongoose.model("Variant");

    // Lấy thống kê đánh giá cho sản phẩm
    const stats = await Review.aggregate([
      {
        $match: {
          product: new mongoose.Types.ObjectId(productId),
          isActive: true,
          deletedAt: null,
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          numReviews: { $sum: 1 },
          ratingCounts: {
            $push: "$rating",
          },
        },
      },
    ]);

    // Mặc định nếu không có đánh giá
    let avgRating = 0;
    let numReviews = 0;
    let ratingDistribution = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };

    if (stats.length > 0) {
      // Làm tròn đến 1 chữ số thập phân
      avgRating = Math.round(stats[0].averageRating * 10) / 10;
      numReviews = stats[0].numReviews;

      // Tính phân bố rating
      if (stats[0].ratingCounts) {
        stats[0].ratingCounts.forEach((rating) => {
          ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        });
      }
    }

    // Cập nhật thông tin rating cho sản phẩm
    await Product.findByIdAndUpdate(productId, {
      rating: avgRating,
      numReviews: numReviews,
      ratingDistribution: ratingDistribution,
    });

    // Cập nhật rating cho các biến thể của sản phẩm
    await Variant.updateMany(
      { product: new mongoose.Types.ObjectId(productId) },
      { rating: avgRating }
    );

    console.log(
      `[review/middleware] Đã cập nhật rating cho sản phẩm ${productId}: ${avgRating} (${numReviews} đánh giá)`
    );
  } catch (error) {
    console.error(`[review/middleware] Lỗi cập nhật rating: ${error.message}`);
  }
}

/**
 * Áp dụng middleware cho Review Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Kiểm tra xác thực mua hàng trước khi tạo đánh giá
  schema.pre("save", async function (next) {
    try {
      if (this.isNew) {
        // Kiểm tra xem người dùng đã mua sản phẩm này chưa
        if (this.order && this.user && this.variant) {
          const Order = mongoose.model("Order");
          const order = await Order.findOne({
            _id: this.order,
            user: this.user,
            "orderItems.variant": this.variant,
            status: "delivered",
          });

          this.isVerifiedPurchase = Boolean(order);

          // Kiểm tra nếu đã có đánh giá cho sản phẩm này từ người dùng
          if (order) {
            const existingReview = await mongoose.model("Review").findOne({
              user: this.user,
              product: this.product,
              variant: this.variant,
              deletedAt: null,
            });

            if (existingReview) {
              return next(new Error("Bạn đã đánh giá sản phẩm này rồi"));
            }
          }
        }

        // Nếu không xác thực được đơn hàng, kiểm tra quyền admin
        if (!this.isVerifiedPurchase) {
          const User = mongoose.model("User");
          const user = await User.findById(this.user);

          // Nếu không phải admin và không xác thực được thì từ chối
          if (user && user.role !== "admin") {
            return next(new Error("Chỉ có thể đánh giá sản phẩm đã mua"));
          }
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Sau khi tạo/cập nhật đánh giá, cập nhật thông tin đánh giá của sản phẩm
  schema.post("save", async function () {
    if (this.product) {
      await updateProductRating(this.product);
    }
  });

  // Trước khi xóa đánh giá, lưu ID sản phẩm
  schema.pre("remove", async function (next) {
    if (this.product) {
      this._productId = this.product;
    }
    next();
  });

  // Sau khi xóa đánh giá, cập nhật thông tin đánh giá sản phẩm
  schema.post("remove", async function () {
    if (this._productId) {
      await updateProductRating(this._productId);
    }
  });

  // Xử lý xóa mềm và khôi phục
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();

      // Xử lý xóa mềm - theo dõi productId để cập nhật rating
      if (update.$set && update.$set.deletedAt !== undefined) {
        const doc = await this.model.findOne(this.getFilter());
        if (doc && doc.product) {
          this._productIdToUpdate = doc.product;
        }
      }

      // Xử lý khôi phục - theo dõi productId để cập nhật rating
      if (update.$set && update.$set.deletedAt === null) {
        const doc = await this.model.findOne(this.getFilter(), {
          includeDeleted: true,
        });
        if (doc && doc.product) {
          this._productIdToUpdate = doc.product;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Cập nhật rating sau khi cập nhật đánh giá
  schema.post("findOneAndUpdate", async function (doc) {
    // Cập nhật rating nếu đánh giá đã thay đổi
    if (doc && doc.product) {
      await updateProductRating(doc.product);
    }

    // Xóa biến tạm để tránh rò rỉ bộ nhớ
    if (this._productIdToUpdate) {
      delete this._productIdToUpdate;
    }
  });
};

module.exports = { applyMiddlewares, updateProductRating };
