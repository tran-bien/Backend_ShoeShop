const asyncHandler = require("express-async-handler");
const Review = require("../../models/review.model");
const Product = require("../../models/product.model");
const mongoose = require("mongoose");
const reviewService = require("../../services/review.service");

/**
 * @desc    Tạo đánh giá mới
 * @route   POST /api/products/:productId/reviews
 * @access  Private
 */
exports.createReview = asyncHandler(async (req, res) => {
  try {
    const reviewData = {
      ...req.body,
      product: req.params.productId,
    };
    const review = await reviewService.createReview(reviewData, req.user._id);
    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo đánh giá",
    });
  }
});

/**
 * @desc    Lấy danh sách đánh giá của sản phẩm
 * @route   GET /api/products/:productId/reviews
 * @access  Public
 */
exports.getProductReviews = asyncHandler(async (req, res) => {
  try {
    const result = await reviewService.getProductReviews(
      req.params.productId,
      req.query
    );
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy đánh giá sản phẩm",
    });
  }
});

/**
 * @desc    Cập nhật đánh giá
 * @route   PUT /api/reviews/:id
 * @access  Private
 */
exports.updateReview = asyncHandler(async (req, res) => {
  try {
    const review = await reviewService.updateReview(
      req.params.id,
      req.body,
      req.user._id
    );
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật đánh giá",
    });
  }
});

/**
 * @desc    Xóa đánh giá
 * @route   DELETE /api/reviews/:id
 * @access  Private
 */
exports.deleteReview = asyncHandler(async (req, res) => {
  try {
    const result = await reviewService.deleteReview(
      req.params.id,
      req.user._id,
      req.user.role === "admin"
    );
    res.status(200).json({
      success: true,
      message: "Đã xóa đánh giá thành công",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi xóa đánh giá",
    });
  }
});

/**
 * @desc    Thích/bỏ thích đánh giá
 * @route   POST /api/reviews/:id/like
 * @access  Private
 */
exports.toggleLikeReview = asyncHandler(async (req, res) => {
  try {
    const result = await reviewService.toggleLikeReview(
      req.params.id,
      req.user._id
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi thích/bỏ thích đánh giá",
    });
  }
});

/**
 * @desc    Lấy thống kê đánh giá của sản phẩm
 * @route   GET /api/products/:productId/reviews/stats
 * @access  Public
 */
exports.getProductReviewStats = asyncHandler(async (req, res) => {
  try {
    const stats = await reviewService.getProductReviewStats(
      req.params.productId
    );
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê đánh giá",
    });
  }
});

/**
 * @desc    Lấy danh sách đánh giá của người dùng
 * @route   GET /api/users/reviews
 * @access  Private
 */
exports.getUserReviews = asyncHandler(async (req, res) => {
  try {
    const result = await reviewService.getUserReviews(req.user._id, req.query);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy đánh giá của người dùng",
    });
  }
});

/**
 * @desc    Lấy chi tiết đánh giá
 * @route   GET /api/reviews/:id
 * @access  Public
 */
exports.getReviewDetails = asyncHandler(async (req, res) => {
  try {
    const review = await reviewService.getReviewDetails(req.params.id);
    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || "Lỗi khi lấy chi tiết đánh giá",
    });
  }
});

// Ẩn đánh giá (Admin)
exports.hideReview = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const review = await Review.findById(reviewId);
  if (!review) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy đánh giá",
    });
  }

  // Cập nhật trạng thái đánh giá
  review.isActive = false;
  await review.save();

  // Cập nhật đánh giá trung bình cho sản phẩm
  await updateProductRating(review.product);

  res.json({
    success: true,
    message: "Đã ẩn đánh giá",
  });
});

// Hàm helper để cập nhật đánh giá trung bình của sản phẩm
const updateProductRating = async (productId) => {
  const stats = await Review.aggregate([
    {
      $match: {
        productId: mongoose.Types.ObjectId(productId),
        isActive: true,
      },
    },
    {
      $group: {
        _id: "$productId",
        averageRating: { $avg: "$rating" },
        numReviews: { $sum: 1 },
      },
    },
  ]);

  let averageRating = 0;
  if (stats.length > 0) {
    averageRating = stats[0].averageRating;
  }

  await Product.findByIdAndUpdate(productId, {
    rating: averageRating,
  });
};

// Lấy tất cả đánh giá (chỉ dành cho Admin)
exports.getAllReviews = asyncHandler(async (req, res) => {
  try {
    // Gọi service để lấy tất cả đánh giá
    const result = await reviewService.getAllReviews(req.query);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách đánh giá",
    });
  }
});

// Lấy chi tiết đánh giá (admin)
exports.getReviewDetail = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Gọi service để lấy chi tiết đánh giá
    const review = await reviewService.getReviewDetail(id);

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      message: error.message || "Lỗi khi lấy chi tiết đánh giá",
    });
  }
});

// Admin cập nhật đánh giá
exports.adminUpdateReview = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { content, rating, status, images } = req.body;

    // Gọi service để cập nhật đánh giá
    const review = await reviewService.updateReview(
      id,
      { content, rating, status, images },
      req.user._id,
      true
    );

    res.status(200).json({
      success: true,
      data: review,
      message: "Admin đã cập nhật đánh giá thành công",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật đánh giá",
    });
  }
});

// Admin xóa đánh giá
exports.adminDeleteReview = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Gọi service để xóa đánh giá
    const result = await reviewService.deleteReview(id, req.user._id, true);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi xóa đánh giá",
    });
  }
});

// Kiểm tra xem người dùng có thể đánh giá sản phẩm không
exports.checkReviewEligibility = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.params;

    // Gọi service để kiểm tra quyền đánh giá
    const result = await reviewService.checkReviewEligibility(
      req.user._id,
      productId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi kiểm tra quyền đánh giá",
    });
  }
});

module.exports = exports;
