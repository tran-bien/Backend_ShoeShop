const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;

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
          product: new mongoose.Types.ObjectId(productId),
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

  // Xóa tất cả ảnh của review từ Cloudinary
  const deleteReviewImages = async function (review) {
    if (!review.images || review.images.length === 0) return;

    try {
      // Lấy tất cả public_id của ảnh
      const publicIds = review.images
        .filter((img) => img.public_id)
        .map((img) => img.public_id);

      if (publicIds.length > 0) {
        // Xóa ảnh từ Cloudinary
        const deletePromises = publicIds.map((publicId) =>
          cloudinary.uploader.destroy(publicId)
        );
        await Promise.all(deletePromises);
        console.log(`Đã xóa ${publicIds.length} ảnh của review ${review._id}`);
      }
    } catch (error) {
      console.error(`Lỗi khi xóa ảnh review: ${error.message}`);
      // Không throw lỗi - vẫn tiếp tục xóa review
    }
  };

  // Sau khi lưu đánh giá
  schema.post("save", async function () {
    await updateProductRating(this.product);
  });

  // Sau khi cập nhật đánh giá
  schema.post("findOneAndUpdate", async function (doc) {
    if (doc) {
      await updateProductRating(doc.product);
    }
  });

  // Trước khi xóa đánh giá
  schema.pre(
    "deleteOne",
    { document: true, query: false },
    async function (next) {
      // Lưu id sản phẩm để cập nhật sau khi xóa
      this._productId = this.product;

      // Xóa ảnh từ Cloudinary nếu có
      await deleteReviewImages(this);
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
      this._productIds = reviews.map((review) => review.product.toString());

      // Xóa ảnh của tất cả review bị ảnh hưởng
      for (const review of reviews) {
        await deleteReviewImages(review);
      }

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
