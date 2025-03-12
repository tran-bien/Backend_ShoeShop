const asyncHandler = require("express-async-handler");
const Review = require("../models/review.model");
const Order = require("../models/order.model");
const Product = require("../models/product.model");
const { uploadImage } = require("../utils/cloudinary");
const mongoose = require("mongoose");

// Tạo đánh giá mới
exports.createReview = asyncHandler(async (req, res) => {
  const { productId, orderId, rating, comment } = req.body;
  const images = req.files || [];

  // Kiểm tra xem người dùng đã mua sản phẩm chưa
  const order = await Order.findOne({
    _id: orderId,
    userId: req.user._id,
    status: "delivered",
    "items.product": productId,
  });

  if (!order) {
    return res.status(400).json({
      success: false,
      message: "Bạn chỉ có thể đánh giá sản phẩm đã mua và nhận hàng",
    });
  }

  // Kiểm tra xem đã đánh giá chưa
  const existingReview = await Review.findOne({
    userId: req.user._id,
    productId,
    orderId,
  });

  if (existingReview) {
    return res.status(400).json({
      success: false,
      message: "Bạn đã đánh giá sản phẩm này cho đơn hàng này rồi",
    });
  }

  try {
    // Tải ảnh lên Cloudinary nếu có
    let imageUrls = [];
    if (images.length > 0) {
      const uploadPromises = images.map((file) =>
        uploadImage(file.path, `reviews/${productId}`)
      );
      const uploadedImages = await Promise.all(uploadPromises);
      imageUrls = uploadedImages.map((img) => img.url);
    }

    // Tạo đánh giá mới
    const review = await Review.create({
      userId: req.user._id,
      productId,
      orderId,
      rating,
      comment,
      images: imageUrls,
    });

    // Cập nhật đánh giá trung bình cho sản phẩm
    await updateProductRating(productId);

    res.status(201).json({
      success: true,
      message: "Đánh giá đã được gửi thành công",
      review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Không thể tạo đánh giá. Vui lòng thử lại!",
      error: error.message,
    });
  }
});

// Lấy đánh giá của sản phẩm
exports.getProductReviews = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { page = 1, limit = 10, sort = "newest" } = req.query;

  // Xây dựng query
  const query = {
    productId,
    status: "active",
  };

  // Xử lý sắp xếp
  let sortOptions = {};
  switch (sort) {
    case "highest":
      sortOptions = { rating: -1 };
      break;
    case "lowest":
      sortOptions = { rating: 1 };
      break;
    case "most_liked":
      sortOptions = { likes: -1 };
      break;
    default:
      sortOptions = { createdAt: -1 };
  }

  // Tính toán skip cho phân trang
  const skip = (Number(page) - 1) * Number(limit);

  // Lấy đánh giá
  const reviews = await Review.find(query)
    .populate("userId", "name image")
    .sort(sortOptions)
    .skip(skip)
    .limit(Number(limit));

  // Đếm tổng số đánh giá
  const count = await Review.countDocuments(query);

  // Tính điểm trung bình và thống kê
  const stats = await Review.aggregate([
    {
      $match: {
        productId: mongoose.Types.ObjectId(productId),
        status: "active",
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

  res.json({
    success: true,
    count,
    totalPages: Math.ceil(count / Number(limit)),
    currentPage: Number(page),
    reviews,
    stats: stats[0] || null,
    ratingDistribution,
  });
});

// Like/Unlike đánh giá
exports.toggleReviewLike = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const review = await Review.findById(reviewId);
  if (!review) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy đánh giá",
    });
  }

  // Tăng/giảm số lượng like
  review.likes = review.likes || 0;
  review.likes += 1;
  await review.save();

  res.json({
    success: true,
    message: "Đã thích đánh giá",
    likes: review.likes,
  });
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
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  // Tìm tất cả đánh giá của người dùng
  const reviews = await Review.find({ userId: req.user._id })
    .populate("productId", "name images")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Đếm tổng số đánh giá
  const total = await Review.countDocuments({ userId: req.user._id });

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Cập nhật đánh giá
exports.updateReview = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  // Tìm đánh giá cần cập nhật
  const review = await Review.findById(id);

  if (!review) {
    res.status(404);
    throw new Error("Không tìm thấy đánh giá");
  }

  // Kiểm tra quyền: chỉ người tạo hoặc admin mới có thể cập nhật
  if (
    review.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Bạn không có quyền cập nhật đánh giá này");
  }

  // Cập nhật các trường
  if (rating) review.rating = rating;
  if (comment) review.comment = comment;

  await review.save();

  // Cập nhật đánh giá trung bình cho sản phẩm
  await updateProductRating(review.productId);

  res.json({
    success: true,
    message: "Đánh giá đã được cập nhật",
    data: review,
  });
});

// Xóa đánh giá
exports.deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Tìm đánh giá cần xóa
  const review = await Review.findById(id);

  if (!review) {
    res.status(404);
    throw new Error("Không tìm thấy đánh giá");
  }

  // Kiểm tra quyền: chỉ người tạo hoặc admin mới có thể xóa
  if (
    review.userId.toString() !== req.user._id.toString() &&
    req.user.role !== "admin"
  ) {
    res.status(403);
    throw new Error("Bạn không có quyền xóa đánh giá này");
  }

  // Lưu productId để cập nhật rating sau khi xóa
  const productId = review.productId;

  // Xóa đánh giá
  await review.deleteOne();

  // Cập nhật đánh giá trung bình cho sản phẩm
  await updateProductRating(productId);

  res.json({
    success: true,
    message: "Đánh giá đã được xóa",
  });
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
  const { page = 1, limit = 10, status, productId, rating } = req.query;
  const skip = (page - 1) * limit;

  // Xây dựng query
  let query = {};

  // Lọc theo trạng thái nếu được cung cấp
  if (status) {
    query.status = status;
  }

  // Lọc theo sản phẩm nếu được cung cấp
  if (productId) {
    query.productId = productId;
  }

  // Lọc theo rating nếu được cung cấp
  if (rating) {
    query.rating = Number(rating);
  }

  // Lấy danh sách đánh giá với thông tin sản phẩm và người dùng
  const reviews = await Review.find(query)
    .populate("userId", "name email image")
    .populate("productId", "name images price sku")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  // Đếm tổng số đánh giá theo bộ lọc
  const total = await Review.countDocuments(query);

  res.json({
    success: true,
    data: {
      reviews,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});
