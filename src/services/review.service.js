const { Review, Product, Variant, Order, User } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const ApiError = require("@utils/ApiError");

const reviewService = {
  /**
   * Lấy danh sách đánh giá của một sản phẩm
   * @param {String} productId - ID sản phẩm
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đánh giá phân trang
   */
  getProductReviews: async (productId, query = {}) => {
    const { page = 1, limit = 10, rating, sort = "createdAt_desc" } = query;

    // Xây dựng điều kiện lọc
    const filter = {
      "productSnapshot.productId": productId,
      isActive: true,
      deletedAt: null,
    };

    // Lọc theo số sao đánh giá
    if (rating && !isNaN(rating)) {
      filter.rating = parseInt(rating);
    }

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOptions,
      populate: [{ path: "user", select: "name" }],
    };

    const result = await paginate(Review, filter, options);

    return {
      success: true,
      ...result,
    };
  },

  /**
   * Lấy chi tiết đánh giá
   * @param {String} reviewId - ID đánh giá
   * @returns {Object} - Chi tiết đánh giá
   */
  getReviewDetail: async (reviewId) => {
    const review = await Review.findOne({
      _id: reviewId,
      isActive: true,
      deletedAt: null,
    }).populate([{ path: "user", select: "name avatar" }]);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    return {
      success: true,
      review,
    };
  },

  /**
   * Tạo đánh giá mới
   * @param {String} userId - ID của người dùng
   * @param {Object} reviewData - Dữ liệu đánh giá
   * @returns {Object} - Đánh giá đã tạo
   */
  createReview: async (userId, reviewData) => {
    // Kiểm tra đơn hàng và orderItem
    const order = await Order.findOne({
      _id: reviewData.orderId,
      user: userId,
      status: "delivered",
    });

    if (!order) {
      throw new ApiError(
        400,
        "Không tìm thấy đơn hàng hoặc đơn hàng chưa được giao. Người dùng không thể đánh giá"
      );
    }

    // Tìm orderItem trong đơn hàng
    const orderItem = order.orderItems.id(reviewData.orderItemId);
    if (!orderItem) {
      throw new ApiError(400, "Không tìm thấy sản phẩm trong đơn hàng. Người dùng không thể đánh giá");
    }

    // Lấy thông tin sản phẩm và variant từ orderItem
    const productId = orderItem.product;
    const variantId = orderItem.variant;

    // Kiểm tra người dùng đã đánh giá orderItem này chưa
    const existingReview = await Review.findOne({
      user: userId,
      orderItem: reviewData.orderItemId,
      deletedAt: null,
    });

    if (existingReview) {
      throw new ApiError(
        400,
        "Bạn đã đánh giá sản phẩm này trong đơn hàng rồi"
      );
    }

    // Kiểm tra sản phẩm và biến thể tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    const variant = await Variant.findById(variantId);
    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể sản phẩm");
    }


    // Lưu thông tin snapshot từ orderItem
    const productSnapshot = {
      productId: productId,
      variantId: variantId,
      orderId: reviewData.orderId,
      name: orderItem.productName || product.name,
      variantName: orderItem.variantName || variant.name,
      sizeName: orderItem.sizeName,
    };

    // Tạo đánh giá mới
    const newReview = new Review({
      user: userId,
      orderItem: reviewData.orderItemId,
      productSnapshot: productSnapshot,
      rating: reviewData.rating,
      title: reviewData.title,
      content: reviewData.content,
      isVerified: true,
    });

    await newReview.save();

    return {
      success: true,
      message: "Đánh giá sản phẩm thành công",
      review: await Review.findById(newReview._id).populate([
        { path: "user", select: "name avatar" },
      ]),
    };
  },

  /**
   * Cập nhật đánh giá
   * @param {String} userId - ID của người dùng
   * @param {String} reviewId - ID của đánh giá
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Đánh giá đã cập nhật
   */
  updateReview: async (userId, reviewId, updateData) => {
    // Kiểm tra đánh giá tồn tại và thuộc về người dùng
    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
      deletedAt: null,
    });

    if (!review) {
      throw new ApiError(
        404,
        "Không tìm thấy đánh giá hoặc bạn không có quyền cập nhật"
      );
    }

    // Những trường được phép cập nhật
    const allowedFields = ["rating", "content"];
    const updateFields = {};

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        updateFields[field] = updateData[field];
      }
    });

    // Cập nhật đánh giá
    const updatedReview = await Review.findByIdAndUpdate(
      reviewId,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).populate([{ path: "user", select: "name avatar" }]);

    return {
      success: true,
      message: "Cập nhật đánh giá thành công",
      review: updatedReview,
    };
  },

  /**
   * Xóa đánh giá (xóa mềm)
   * @param {String} userId - ID của người dùng
   * @param {String} reviewId - ID của đánh giá
   * @returns {Object} - Kết quả xóa
   */
  deleteReview: async (userId, reviewId) => {
    // Kiểm tra đánh giá tồn tại và thuộc về người dùng
    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
      deletedAt: null,
    });

    if (!review) {
      throw new ApiError(
        404,
        "Không tìm thấy đánh giá hoặc bạn không có quyền xóa"
      );
    }

    // Xóa mềm đánh giá
    await Review.findByIdAndUpdate(reviewId, {
      $set: {
        deletedAt: new Date(),
        deletedBy: userId,
      },
    });

    return {
      success: true,
      message: "Xóa đánh giá thành công",
    };
  },

  /**
   * Thích/bỏ thích đánh giá
   * @param {String} userId - ID của người dùng
   * @param {String} reviewId - ID của đánh giá
   * @returns {Object} - Kết quả thích/bỏ thích
   */
  toggleLikeReview: async (userId, reviewId) => {
    // Kiểm tra đánh giá tồn tại
    const review = await Review.findOne({
      _id: reviewId,
      isActive: true,
      deletedAt: null,
    });

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    // Kiểm tra xem người dùng đã thích đánh giá này chưa
    const hasLiked = review.likes.includes(userId);

    if (hasLiked) {
      // Nếu đã thích, bỏ thích
      await Review.findByIdAndUpdate(reviewId, {
        $pull: { likes: userId },
      });
      return {
        success: true,
        message: "Đã bỏ thích đánh giá",
        liked: false,
      };
    } else {
      // Nếu chưa thích, thêm thích
      await Review.findByIdAndUpdate(reviewId, {
        $addToSet: { likes: userId },
      });
      return {
        success: true,
        message: "Đã thích đánh giá",
        liked: true,
      };
    }
  },

  /**
   * Lấy danh sách đánh giá của người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} query - Các tham số truy vấn
   * @returns {Object} - Danh sách đánh giá phân trang
   */
  getUserReviews: async (userId, query = {}) => {
    const { page = 1, limit = 10, sort = "createdAt_desc" } = query;

    // Xây dựng điều kiện lọc
    const filter = {
      user: userId,
      deletedAt: null,
    };

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOptions,
      populate: [{ path: "user", select: "name avatar" }],
    };

    const result = await paginate(Review, filter, options);

    return {
      success: true,
      ...result,
    };
  },
};

/**
 * ADMIN REVIEW SERVICE - Quản lý đánh giá
 */
const adminReviewService = {
  /**
   * Lấy danh sách tất cả đánh giá
   * @param {Object} query - Các tham số truy vấn và phân trang
   * @returns {Object} - Danh sách đánh giá phân trang
   */
  getAllReviews: async (query = {}) => {
    const {
      page = 1,
      limit = 10,
      productId,
      userId,
      rating,
      isVerified,
      isActive,
      showDeleted,
      sort = "createdAt_desc",
    } = query;

    // Xây dựng điều kiện lọc
    const filter = {};

    if (productId) {
      filter["productSnapshot.productId"] = productId;
    }

    if (userId) {
      filter.user = userId;
    }

    if (rating && !isNaN(rating)) {
      filter.rating = parseInt(rating);
    }

    if (isVerified !== undefined) {
      filter.isVerified = isVerified === "true" || isVerified === true;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    // Hiển thị cả đánh giá đã xóa mềm nếu được chỉ định
    if (showDeleted !== "true" && showDeleted !== true) {
      filter.deletedAt = null;
    }

    // Xây dựng thông tin sắp xếp
    const sortOptions = {};
    if (sort) {
      const [field, order] = sort.split("_");
      sortOptions[field] = order === "desc" ? -1 : 1;
    }

    // Thực hiện truy vấn với phân trang
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOptions,
      populate: [
        { path: "user", select: "name email avatar" },
        { path: "deletedBy", select: "name email" },
      ],
    };

    const result = await paginate(Review, filter, options);

    return {
      success: true,
      ...result,
    };
  },

  /**
   * Lấy chi tiết đánh giá (bao gồm cả đánh giá đã xóa)
   * @param {String} reviewId - ID đánh giá
   * @returns {Object} - Chi tiết đánh giá
   */
  getReviewById: async (reviewId) => {
    const review = await Review.findById(reviewId).populate([
      { path: "user", select: "name email avatar" },
      { path: "deletedBy", select: "name email" },
    ]);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    return {
      success: true,
      review,
    };
  },

  /**
   * Ẩn/hiện đánh giá
   * @param {String} reviewId - ID đánh giá
   * @param {Boolean} isActive - Trạng thái đánh giá (true: hiện, false: ẩn)
   * @returns {Object} - Kết quả cập nhật
   */
  toggleReviewVisibility: async (reviewId, isActive) => {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    // Không thể kích hoạt lại đánh giá đã xóa mềm
    if (review.deletedAt && isActive) {
      throw new ApiError(400, "Không thể kích hoạt đánh giá đã xóa");
    }

    review.isActive = isActive;
    await review.save();

    const status = isActive ? "hiển thị" : "ẩn";
    return {
      success: true,
      message: `Đã ${status} đánh giá thành công`,
      review,
    };
  },

  /**
   * Khôi phục đánh giá đã xóa mềm
   * @param {String} reviewId - ID đánh giá
   * @returns {Object} - Kết quả khôi phục
   */
  restoreReview: async (reviewId) => {
    const review = await Review.findById(reviewId);

    if (!review) {
      throw new ApiError(404, "Không tìm thấy đánh giá");
    }

    if (!review.deletedAt) {
      throw new ApiError(400, "Đánh giá chưa bị xóa");
    }

    review.deletedAt = null;
    review.deletedBy = null;
    await review.save();

    return {
      success: true,
      message: "Khôi phục đánh giá thành công",
      review,
    };
  },

  /**
   * Thống kê đánh giá theo sản phẩm
   * @param {String} productId - ID sản phẩm
   * @returns {Object} - Thống kê đánh giá
   */
  getProductReviewStats: async (productId) => {
    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    // Tính thống kê đánh giá - chỉ từ đánh giá active và không bị xóa mềm
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
          totalReviews: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          verifiedReviews: {
            $sum: { $cond: [{ $eq: ["$isVerified", true] }, 1, 0] },
          },
          ratingCounts: {
            $push: "$rating",
          },
        },
      },
    ]);

    // Mặc định nếu không có đánh giá
    let result = {
      totalReviews: 0,
      avgRating: 0,
      verifiedReviews: 0,
      ratingDistribution: {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      },
    };

    if (stats.length > 0) {
      // Tính phân bố đánh giá
      const ratingDistribution = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };

      if (stats[0].ratingCounts) {
        stats[0].ratingCounts.forEach((rating) => {
          ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
        });
      }

      result = {
        totalReviews: stats[0].totalReviews,
        avgRating: Math.round(stats[0].avgRating * 10) / 10,
        verifiedReviews: stats[0].verifiedReviews,
        ratingDistribution,
      };
    }

    // Thêm thống kê về tổng số đánh giá (bao gồm cả đã ẩn và đã xóa)
    const allReviewsCount = await Review.countDocuments({
      "productSnapshot.productId": productId,
    });

    const hiddenReviewsCount = await Review.countDocuments({
      "productSnapshot.productId": productId,
      isActive: false,
      deletedAt: null,
    });

    const deletedReviewsCount = await Review.countDocuments({
      "productSnapshot.productId": productId,
      deletedAt: { $ne: null },
    });

    result.allReviewsStats = {
      total: allReviewsCount,
      active: result.totalReviews,
      hidden: hiddenReviewsCount,
      deleted: deletedReviewsCount,
    };

    return {
      success: true,
      stats: result,
    };
  },
};

// Kết hợp services để export
const exportedReviewService = {
  ...reviewService,
  adminReviewService,
};

module.exports = exportedReviewService;
