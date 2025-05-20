const asyncHandler = require("express-async-handler");
const reviewService = require("@services/review.service");

const reviewController = {
  /**
   * @desc    Lấy danh sách đánh giá của người dùng hiện tại
   * @route   GET /api/users/reviews/my-reviews
   * @access  Private
   */
  getUserReviews: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await reviewService.getUserReviews(userId, req.query);
    res.json(result);
  }),

  /**
   * @desc    Tạo đánh giá sản phẩm mới
   * @route   POST /api/users/reviews
   * @access  Private
   */
  createReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Chuẩn bị dữ liệu review
    const reviewData = { ...req.body };
    const result = await reviewService.createReview(userId, reviewData);
    res.status(201).json(result);
  }),

  /**
   * @desc    Cập nhật đánh giá
   * @route   PUT /api/users/reviews/:reviewId
   * @access  Private
   */
  updateReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;

    // Chuẩn bị dữ liệu cập nhật
    const updateData = { ...req.body };

    const result = await reviewService.updateReview(
      userId,
      reviewId,
      updateData
    );
    res.json(result);
  }),

  /**
   * @desc    Xóa đánh giá
   * @route   DELETE /api/users/reviews/:reviewId
   * @access  Private
   */
  deleteReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;
    const result = await reviewService.deleteReview(userId, reviewId);
    res.json(result);
  }),

  /**
   * @desc    Thích/bỏ thích đánh giá
   * @route   POST /api/users/reviews/:reviewId/like
   * @access  Private
   */
  toggleLikeReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;
    const result = await reviewService.toggleLikeReview(userId, reviewId);
    res.json(result);
  }),
};

module.exports = reviewController;
