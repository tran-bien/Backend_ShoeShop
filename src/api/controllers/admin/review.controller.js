const asyncHandler = require("express-async-handler");
const reviewService = require("@services/review.service");

const reviewController = {
  /**
   * @route   GET /api/admin/reviews
   * @desc    Lấy danh sách tất cả đánh giá
   * @access  Admin
   */
  getAllReviews: asyncHandler(async (req, res) => {
    const result = await reviewService.adminReviewService.getAllReviews(
      req.query
    );

    res.json({
      success: true,
      ...result,
    });
  }),

  /**
   * @route   GET /api/admin/reviews/:id
   * @desc    Lấy chi tiết đánh giá (bao gồm cả đánh giá đã xóa)
   * @access  Admin
   */
  getReviewById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await reviewService.adminReviewService.getReviewById(id);

    res.json({
      success: true,
      review: result.review,
    });
  }),

  /**
   * @route   PATCH /api/admin/reviews/:id/visibility
   * @desc    Ẩn/hiện đánh giá
   * @access  Admin
   */
  toggleReviewVisibility: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    const result =
      await reviewService.adminReviewService.toggleReviewVisibility(
        id,
        isActive
      );

    res.json({
      success: true,
      message: result.message,
      review: result.review,
    });
  }),

  /**
   * @route   PATCH /api/admin/reviews/:id/restore
   * @desc    Khôi phục đánh giá đã xóa
   * @access  Admin
   */
  restoreReview: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await reviewService.adminReviewService.restoreReview(id);

    res.json({
      success: true,
      message: result.message,
      review: result.review,
    });
  }),

  /**
   * @route   GET /api/admin/products/:productId/reviews/stats
   * @desc    Lấy thống kê đánh giá của sản phẩm
   * @access  Admin
   */
  getProductReviewStats: asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const result = await reviewService.adminReviewService.getProductReviewStats(
      productId
    );

    res.json({
      success: true,
      stats: result.stats,
    });
  }),
};

module.exports = reviewController;
