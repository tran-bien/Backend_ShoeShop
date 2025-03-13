const Product = require("../models/product.model");
const Review = require("../models/review.model");
const Order = require("../models/order.model");
const mongoose = require("mongoose");
const paginationService = require("./pagination.service");

const reviewService = {
  /**
   * Lấy danh sách đánh giá của một sản phẩm
   * @param {String} productId - ID sản phẩm
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Object} - Kết quả phân trang với danh sách đánh giá
   */
  getProductReviews: async (productId, queryParams) => {
    // Xây dựng query
    const query = { product: productId };

    // Thêm điều kiện lọc nếu cần
    if (queryParams.rating) {
      query.rating = parseInt(queryParams.rating);
    }

    if (queryParams.status) {
      query.status = queryParams.status;
    }

    // Tạo thông tin phân trang và sắp xếp
    const { pagination, sort } = paginationService.createPaginationQuery(
      queryParams,
      {
        defaultSortField: "createdAt",
        defaultSortOrder: "desc",
      }
    );

    // Thực hiện truy vấn với phân trang
    const reviews = await Review.find(query)
      .populate("user", "name avatar")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Đếm tổng số bản ghi
    const total = await Review.countDocuments(query);

    // Tạo response phân trang
    return paginationService.createPaginationResponse(
      reviews,
      total,
      pagination
    );
  },

  /**
   * Lấy danh sách đánh giá của người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Object} - Kết quả phân trang với danh sách đánh giá
   */
  getUserReviews: async (userId, queryParams) => {
    // Xây dựng query
    const query = { user: userId };

    // Thêm điều kiện lọc nếu cần
    if (queryParams.productId) {
      query.product = queryParams.productId;
    }

    if (queryParams.rating) {
      query.rating = parseInt(queryParams.rating);
    }

    // Tạo thông tin phân trang và sắp xếp
    const { pagination, sort } = paginationService.createPaginationQuery(
      queryParams,
      {
        defaultSortField: "createdAt",
        defaultSortOrder: "desc",
      }
    );

    // Thực hiện truy vấn với phân trang
    const reviews = await Review.find(query)
      .populate("product", "name thumbnail")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Đếm tổng số bản ghi
    const total = await Review.countDocuments(query);

    // Tạo response phân trang
    return paginationService.createPaginationResponse(
      reviews,
      total,
      pagination
    );
  },

  /**
   * Lấy toàn bộ đánh giá (admin)
   * @param {Object} queryParams - Các tham số truy vấn
   * @returns {Object} - Kết quả phân trang với danh sách đánh giá
   */
  getAllReviews: async (queryParams) => {
    // Xây dựng query
    const query = {};

    // Thêm điều kiện lọc nếu cần
    if (queryParams.productId) {
      query.product = queryParams.productId;
    }

    if (queryParams.userId) {
      query.user = queryParams.userId;
    }

    if (queryParams.rating) {
      query.rating = parseInt(queryParams.rating);
    }

    if (queryParams.status) {
      query.status = queryParams.status;
    }

    // Tạo thông tin phân trang và sắp xếp
    const { pagination, sort } = paginationService.createPaginationQuery(
      queryParams,
      {
        defaultSortField: "createdAt",
        defaultSortOrder: "desc",
      }
    );

    // Thực hiện truy vấn với phân trang
    const reviews = await Review.find(query)
      .populate("user", "name email avatar")
      .populate("product", "name thumbnail")
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Đếm tổng số bản ghi
    const total = await Review.countDocuments(query);

    // Tạo response phân trang
    return paginationService.createPaginationResponse(
      reviews,
      total,
      pagination
    );
  },

  /**
   * Tạo đánh giá mới
   * @param {String} userId - ID người dùng
   * @param {Object} reviewData - Dữ liệu đánh giá
   * @returns {Object} - Đánh giá đã tạo
   */
  createReview: async (userId, reviewData) => {
    const { productId, content, rating, images, orderId, variantId } =
      reviewData;

    // Kiểm tra sản phẩm tồn tại
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Nếu có orderId, kiểm tra xem đơn hàng có thuộc về người dùng hiện tại không
    if (orderId) {
      const order = await Order.findOne({
        _id: orderId,
        user: userId,
        "orderItems.product": productId,
      });

      if (!order) {
        throw new Error("Bạn chỉ có thể đánh giá sản phẩm mà bạn đã mua");
      }

      // Kiểm tra xem đã đánh giá sản phẩm trong đơn hàng này chưa
      const existingReview = await Review.findOne({
        user: userId,
        product: productId,
        order: orderId,
      });

      if (existingReview) {
        throw new Error("Bạn đã đánh giá sản phẩm này trong đơn hàng");
      }
    }

    // Tạo review mới
    const newReview = await Review.create({
      user: userId,
      product: productId,
      content: content || "",
      rating: parseInt(rating),
      images: images || [],
      status: "approved", // Mặc định đánh giá được chấp nhận
      order: orderId || undefined,
      variant: variantId || undefined,
    });

    // Cập nhật rating trung bình của sản phẩm
    await updateProductRating(productId);

    return await Review.findById(newReview._id)
      .populate("user", "name avatar")
      .populate("product", "name thumbnail");
  },

  /**
   * Cập nhật đánh giá
   * @param {String} reviewId - ID đánh giá
   * @param {Object} updateData - Dữ liệu cập nhật
   * @param {String} userId - ID người dùng thực hiện
   * @param {Boolean} isAdmin - Có phải admin không
   * @returns {Object} - Đánh giá đã cập nhật
   */
  updateReview: async (reviewId, updateData, userId, isAdmin = false) => {
    // Tìm review
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new Error("Không tìm thấy đánh giá");
    }

    // Kiểm tra quyền
    if (!isAdmin && review.user.toString() !== userId.toString()) {
      throw new Error("Bạn không có quyền cập nhật đánh giá này");
    }

    // Cập nhật các trường
    const allowedFields = isAdmin
      ? ["content", "rating", "status", "images", "adminReply"]
      : ["content", "rating", "images"];

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        review[field] = updateData[field];
      }
    }

    // Nếu rating thay đổi, cập nhật reply date
    if (updateData.rating !== undefined) {
      review.updatedAt = new Date();
    }

    // Nếu admin reply thay đổi, cập nhật reply date
    if (isAdmin && updateData.adminReply !== undefined) {
      review.adminReplyDate = new Date();
    }

    // Lưu đánh giá
    await review.save();

    // Cập nhật rating trung bình của sản phẩm nếu rating thay đổi
    if (updateData.rating !== undefined) {
      await updateProductRating(review.product);
    }

    return await Review.findById(reviewId)
      .populate("user", "name avatar")
      .populate("product", "name thumbnail");
  },

  /**
   * Xóa đánh giá
   * @param {String} reviewId - ID đánh giá
   * @param {String} userId - ID người dùng thực hiện
   * @param {Boolean} isAdmin - Có phải admin không
   * @returns {Object} - Kết quả xóa
   */
  deleteReview: async (reviewId, userId, isAdmin = false) => {
    // Tìm review
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new Error("Không tìm thấy đánh giá");
    }

    // Kiểm tra quyền
    if (!isAdmin && review.user.toString() !== userId.toString()) {
      throw new Error("Bạn không có quyền xóa đánh giá này");
    }

    // Lấy productId trước khi xóa để cập nhật rating
    const productId = review.product;

    // Xóa review
    await review.remove();

    // Cập nhật rating trung bình của sản phẩm
    await updateProductRating(productId);

    return { message: "Đã xóa đánh giá thành công" };
  },

  /**
   * Lấy chi tiết đánh giá
   * @param {String} reviewId - ID đánh giá
   * @returns {Object} - Thông tin chi tiết đánh giá
   */
  getReviewDetail: async (reviewId) => {
    const review = await Review.findById(reviewId)
      .populate("user", "name email avatar")
      .populate("product", "name thumbnail")
      .populate("order", "orderCode")
      .populate("variant", "color size");

    if (!review) {
      throw new Error("Không tìm thấy đánh giá");
    }

    return review;
  },

  /**
   * Like hoặc unlike một đánh giá
   * @param {String} reviewId - ID đánh giá
   * @param {String} userId - ID người dùng thực hiện
   * @returns {Object} - Kết quả like/unlike
   */
  toggleLikeReview: async (reviewId, userId) => {
    // Tìm review
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new Error("Không tìm thấy đánh giá");
    }

    // Kiểm tra xem người dùng đã like chưa
    const isLiked = review.likes.includes(userId);

    // Toggle like
    if (isLiked) {
      // Unlike - Xóa userId khỏi mảng likes
      review.likes = review.likes.filter(
        (id) => id.toString() !== userId.toString()
      );
    } else {
      // Like - Thêm userId vào mảng likes
      review.likes.push(userId);
    }

    // Lưu thay đổi
    await review.save();

    // Trả về trạng thái mới
    return {
      isLiked: !isLiked,
      likeCount: review.likes.length,
      message: isLiked ? "Đã bỏ thích đánh giá" : "Đã thích đánh giá",
    };
  },

  /**
   * Kiểm tra xem người dùng có thể đánh giá sản phẩm không
   * @param {String} userId - ID người dùng
   * @param {String} productId - ID sản phẩm
   * @returns {Object} - Kết quả kiểm tra
   */
  checkReviewEligibility: async (userId, productId) => {
    // Kiểm tra xem người dùng đã mua sản phẩm này chưa
    const Order = mongoose.model("Order");
    const hasPurchased = await Order.exists({
      user: userId,
      "orderItems.product": productId,
      status: "delivered",
    });

    // Kiểm tra xem người dùng đã đánh giá sản phẩm này chưa
    const hasReviewed = await Review.exists({
      user: userId,
      product: productId,
    });

    return {
      canReview: hasPurchased && !hasReviewed,
      hasPurchased: !!hasPurchased,
      hasReviewed: !!hasReviewed,
    };
  },
};

/**
 * Cập nhật rating trung bình của sản phẩm
 * @param {String} productId - ID sản phẩm
 */
async function updateProductRating(productId) {
  // Tính toán rating trung bình
  const result = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$product",
        avgRating: { $avg: "$rating" },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  // Cập nhật sản phẩm
  if (result.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      rating: result[0].avgRating,
      numReviews: result[0].numReviews,
    });
  } else {
    // Không có đánh giá nào
    await Product.findByIdAndUpdate(productId, {
      rating: 0,
      numReviews: 0,
    });
  }
}

module.exports = reviewService;
