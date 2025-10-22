const express = require("express");
const {
  protect,
  requireStaff,
  requireStaffOrAdmin,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");
const reviewController = require("@controllers/admin/review.controller");
const reviewValidator = require("@validators/review.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/v1/admin/reviews
 * @desc    Lấy danh sách tất cả đánh giá
 * @access  Staff/Admin
 */
router.get(
  "/",
  requireStaffOrAdmin,
  validate(reviewValidator.validateGetAllReviews),
  reviewController.getAllReviews
);

/**
 * @route   GET /api/v1/admin/reviews/deleted
 * @desc    Lấy danh sách tất cả đánh giá đã xóa
 * @access  Staff/Admin
 */
router.get(
  "/deleted",
  requireStaffOrAdmin,
  validate(reviewValidator.validateGetAllReviews),
  reviewController.getAllReviewsDeleted
);

/**
 * @route   GET /api/v1/admin/reviews/:id
 * @desc    Lấy chi tiết đánh giá (bao gồm cả đánh giá đã xóa)
 * @access  Staff/Admin
 */
router.get(
  "/:id",
  requireStaffOrAdmin,
  validate(reviewValidator.validateGetReviewDetail),
  reviewController.getReviewById
);

/**
 * @route   PATCH /api/v1/admin/reviews/:id/visibility
 * @desc    Ẩn/hiện đánh giá
 * @access  Staff/Admin
 */
router.patch(
  "/:id/visibility",
  requireStaffOrAdmin,
  validate(reviewValidator.validateToggleReviewVisibility),
  reviewController.toggleReviewVisibility
);

/**
 * @route   GET /api/v1/admin/reviews/:productId/stats
 * @desc    Lấy thống kê đánh giá của sản phẩm
 * @access  Staff/Admin
 */
router.get(
  "/:productId/stats",
  requireStaffOrAdmin,
  validate(reviewValidator.validateGetProductReviews),
  reviewController.getProductReviewStats
);

module.exports = router;
