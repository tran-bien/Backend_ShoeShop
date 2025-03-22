const mongoose = require("mongoose");
/**
 * Cập nhật rating trung bình của sản phẩm
 * @param {string} productId - ID của sản phẩm
 */
async function updateProductRating(productId) {
  const Review = mongoose.model("Review");
  const Product = mongoose.model("Product");

  const stats = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        isActive: true,
        deletedAt: null, // Chỉ tính đánh giá chưa bị xóa
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

const applyMiddlewares = (schema) => {
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

  // Cập nhật rating sau khi cập nhật đánh giá
  schema.post("findOneAndUpdate", async function (doc) {
    if (doc && doc.product) {
      await updateProductRating(doc.product);
    }
  });

  // Sau khi xóa đánh giá, cập nhật thông tin đánh giá sản phẩm
  schema.post("remove", async function () {
    if (this._productId) {
      await updateProductRating(this._productId);
    }
  });

  // Kiểm tra nếu là verified purchase
  schema.pre("save", async function (next) {
    if (this.isNew && this.order && this.user && this.variant) {
      // Kiểm tra xem đơn hàng có tồn tại và thuộc về người dùng hiện tại không
      const Order = mongoose.model("Order");
      const order = await Order.findOne({
        _id: this.order,
        user: this.user,
        "orderItems.variant": this.variant,
        status: "delivered",
      });

      if (order) {
        this.isVerifiedPurchase = true;
      }
    }
    next();
  });

  // Xử lý xóa mềm - cập nhật rating sau khi xóa mềm
  schema.pre("findOneAndUpdate", async function (next) {
    const update = this.getUpdate();

    // Nếu đang cập nhật trường deletedAt (thực hiện xóa mềm)
    if (update && update.$set && update.$set.deletedAt !== undefined) {
      try {
        const doc = await this.model.findOne(this.getFilter());

        // Lưu productId để cập nhật rating sau khi xóa mềm
        if (doc && doc.product) {
          this._productIdToUpdate = doc.product;
        }
      } catch (error) {
        console.error("Lỗi khi lấy thông tin review trước khi xóa mềm:", error);
      }
    }

    // Nếu đang khôi phục review (đặt deletedAt thành null)
    if (update && update.$set && update.$set.deletedAt === null) {
      try {
        const doc = await this.model.findOne(this.getFilter(), {
          includeDeleted: true,
        });

        // Lưu productId để cập nhật rating sau khi khôi phục
        if (doc && doc.product) {
          this._productIdToUpdate = doc.product;
        }
      } catch (error) {
        console.error(
          "Lỗi khi lấy thông tin review trước khi khôi phục:",
          error
        );
      }
    }

    next();
  });

  // Sau khi cập nhật (xóa mềm/khôi phục), cập nhật rating của sản phẩm
  schema.post("findOneAndUpdate", async function () {
    if (this._productIdToUpdate) {
      await updateProductRating(this._productIdToUpdate);
      // Xóa biến tạm để tránh rò rỉ bộ nhớ
      delete this._productIdToUpdate;
    }
  });
};

module.exports = { applyMiddlewares, updateProductRating };
