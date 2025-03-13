const asyncHandler = require("express-async-handler");
const Review = require("../models/review.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const reviewService = require("../services/review.service");

// Tạo đánh giá mới
exports.createReview = asyncHandler(async (req, res) => {
  try {
    const { productId, content, rating, images, orderId, variantId } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp ID sản phẩm",
      });
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đánh giá từ 1-5 sao",
      });
    }

    // Gọi service để tạo đánh giá
    const review = await reviewService.createReview(req.user._id, {
      productId,
      content,
      rating,
      images,
      orderId,
      variantId,
    });

    res.status(201).json({
      success: true,
      data: review,
      message: "Đã thêm đánh giá thành công",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo đánh giá",
    });
  }
});

// Lấy đánh giá của sản phẩm
exports.getProductReviews = asyncHandler(async (req, res) => {
  try {
    const { id: productId } = req.params;

    // Gọi service để lấy đánh giá sản phẩm
    const result = await reviewService.getProductReviews(productId, req.query);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy đánh giá sản phẩm",
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
  review.status = "hidden";
  await review.save();

  // Cập nhật đánh giá trung bình cho sản phẩm
  await updateProductRating(review.productId);

  res.json({
    success: true,
    message: "Đã ẩn đánh giá",
  });
});

// Lấy đánh giá của người dùng đang đăng nhập
exports.getUserReviews = asyncHandler(async (req, res) => {
  try {
    // Gọi service để lấy đánh giá của người dùng
    const result = await reviewService.getUserReviews(req.user._id, req.query);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy đánh giá người dùng",
    });
  }
});

// Cập nhật đánh giá
exports.updateReview = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { content, rating, images } = req.body;

    // Gọi service để cập nhật đánh giá
    const review = await reviewService.updateReview(
      id,
      { content, rating, images },
      req.user._id,
      false
    );

    res.status(200).json({
      success: true,
      data: review,
      message: "Đã cập nhật đánh giá thành công",
    });
  } catch (error) {
    res.status(error.message.includes("không có quyền") ? 403 : 400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật đánh giá",
    });
  }
});

// Xóa đánh giá
exports.deleteReview = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Gọi service để xóa đánh giá
    const result = await reviewService.deleteReview(id, req.user._id, false);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(error.message.includes("không có quyền") ? 403 : 400).json({
      success: false,
      message: error.message || "Lỗi khi xóa đánh giá",
    });
  }
});

// Hàm helper để cập nhật đánh giá trung bình của sản phẩm
const updateProductRating = async (productId) => {
  const stats = await Review.aggregate([
    {
      $match: {
        productId: mongoose.Types.ObjectId(productId),
        status: "active",
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

// Lấy thống kê đánh giá của sản phẩm
exports.getReviewStatistics = asyncHandler(async (req, res) => {
  const { productId } = req.params;

  // Xác thực productId
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    return res.status(400).json({
      success: false,
      message: "ID sản phẩm không hợp lệ",
    });
  }

  // Tính thống kê đánh giá
  const stats = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: null,
        avgRating: { $avg: "$rating" },
        totalReviews: { $sum: 1 },
        ratings: {
          $push: "$rating",
        },
      },
    },
  ]);

  // Tính phân bố rating
  let ratingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  if (stats.length > 0) {
    stats[0].ratings.forEach((rating) => {
      ratingDistribution[rating]++;
    });
  }

  // Tính phần trăm từng loại rating
  const totalReviews = stats.length > 0 ? stats[0].totalReviews : 0;
  const ratingPercentages = {};

  for (const [rating, count] of Object.entries(ratingDistribution)) {
    ratingPercentages[rating] =
      totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
  }

  res.json({
    success: true,
    stats:
      stats.length > 0
        ? {
            averageRating: stats[0].avgRating,
            totalReviews: stats[0].totalReviews,
          }
        : {
            averageRating: 0,
            totalReviews: 0,
          },
    ratingDistribution,
    ratingPercentages,
  });
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
    const { content, rating, status, adminReply, images } = req.body;

    // Gọi service để cập nhật đánh giá
    const review = await reviewService.updateReview(
      id,
      { content, rating, status, adminReply, images },
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

// Thích hoặc bỏ thích một đánh giá
exports.toggleLikeReview = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Gọi service để toggle like
    const result = await reviewService.toggleLikeReview(id, req.user._id);

    res.status(200).json({
      success: true,
      data: result,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi thích/bỏ thích đánh giá",
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
