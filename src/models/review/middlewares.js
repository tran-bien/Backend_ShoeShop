const mongoose = require("mongoose");

/**
 * Áp dụng middleware cho Review Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Sau khi tạo hoặc cập nhật đánh giá, cập nhật rating trung bình cho sản phẩm
  const updateProductRating = async function (orderItemId) {
    try {
      const Product = mongoose.model("Product");
      const Order = mongoose.model("Order");
      const Review = mongoose.model("Review");
      const Variant = mongoose.model("Variant");

      // Tìm orderItem trong đơn hàng thông qua truy vấn aggregation
      const orderItemInfo = await Order.aggregate([
        { $unwind: "$orderItems" },
        { $match: { "orderItems._id": new mongoose.Types.ObjectId(orderItemId) } },
        { $project: { 
          variantId: "$orderItems.variant",
          _id: 0 
        }}
      ]).exec();

      // Nếu không tìm thấy thông tin orderItem, thoát
      if (!orderItemInfo || orderItemInfo.length === 0 || !orderItemInfo[0].variantId) {
        console.log(`Không tìm thấy OrderItem với ID: ${orderItemId}`);
        return;
      }

      // Lấy variant để tìm product
      const variantId = orderItemInfo[0].variantId;
      const variant = await Variant.findById(variantId);
      
      if (!variant || !variant.product) {
        console.log(`Không thể tìm thấy sản phẩm từ variant: ${variantId}`);
        return;
      }
      
      const productId = variant.product;

      console.log(`Tìm thấy productId: ${productId} từ variantId: ${variantId}`);

      // Tìm tất cả các variant của sản phẩm này
      const allVariants = await Variant.find({ product: productId });
      const variantIds = allVariants.map(v => v._id);
      
      // Tìm tất cả orderItems thuộc các variant của sản phẩm này
      const allOrderItems = await Order.aggregate([
        { $unwind: "$orderItems" },
        { $match: { "orderItems.variant": { $in: variantIds.map(id => new mongoose.Types.ObjectId(id)) } } },
        { $project: { orderItemId: "$orderItems._id" } }
      ]);

      const orderItemIds = allOrderItems.map(item => item.orderItemId);

      // Tính trung bình đánh giá từ tất cả các đánh giá có liên quan 
      const stats = await Review.aggregate([
        {
          $match: {
            orderItem: { $in: orderItemIds },
            isActive: true,
            deletedAt: null,
          }
        },
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
            numReviews: { $sum: 1 }
          }
        }
      ]);

      // Cập nhật sản phẩm
      if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
          rating: Math.round(stats[0].avgRating * 10) / 10,
          numReviews: stats[0].numReviews,
        });
        console.log(`Đã cập nhật rating sản phẩm ${productId}: ${stats[0].avgRating}, số lượng đánh giá: ${stats[0].numReviews}`);
      } else {
        await Product.findByIdAndUpdate(productId, {
          rating: 0,
          numReviews: 0,
        });
        console.log(`Đã reset rating sản phẩm ${productId} về 0`);
      }
    } catch (error) {
      console.error("Lỗi cập nhật đánh giá sản phẩm:", error);
    }
  };

  // Sau khi lưu đánh giá
  schema.post("save", async function () {
    await updateProductRating(this.orderItem);
  });

  // Sau khi cập nhật đánh giá
  schema.post("findOneAndUpdate", async function (doc) {
    if (doc && doc.orderItem) {
      await updateProductRating(doc.orderItem);
    }
  });

  // Trước khi xóa đánh giá
  schema.pre(
    "deleteOne",
    { document: true, query: false },
    async function (next) {
      // Lưu orderItem để cập nhật sau khi xóa
      this._orderItemId = this.orderItem;
      next();
    }
  );

  // Sau khi xóa đánh giá
  schema.post("deleteOne", { document: true, query: false }, async function () {
    if (this._orderItemId) {
      await updateProductRating(this._orderItemId);
    }
  });

  // Xử lý cho deleteMany
  schema.pre("deleteMany", async function (next) {
    try {
      // Lấy danh sách review bị ảnh hưởng để cập nhật rating
      const reviews = await this.model.find(this.getFilter());

      // Lưu thông tin để xử lý sau khi xóa
      this._reviews = reviews;
      this._orderItemIds = reviews
        .map((review) => review.orderItem ? review.orderItem.toString() : null)
        .filter((id) => id !== null);

      next();
    } catch (error) {
      next(error);
    }
  });

  schema.post("deleteMany", async function () {
    // Cập nhật tất cả sản phẩm bị ảnh hưởng
    if (this._orderItemIds && this._orderItemIds.length > 0) {
      // Sử dụng Set để loại bỏ các ID trùng lặp
      const uniqueOrderItemIds = [...new Set(this._orderItemIds)];
      for (const orderItemId of uniqueOrderItemIds) {
        await updateProductRating(orderItemId);
      }
    }
  });

  // Softdelete - khi đánh dấu xóa mềm
  schema.post("findOneAndUpdate", async function (doc) {
    // Nếu bản ghi đã được đánh dấu xóa mềm (deletedAt có giá trị), cập nhật rating
    if (doc && doc.deletedAt && doc.orderItem) {
      await updateProductRating(doc.orderItem);
    }
  });
};

module.exports = { applyMiddlewares };