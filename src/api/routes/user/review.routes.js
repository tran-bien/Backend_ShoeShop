const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const reviewController = require("@controllers/user/review.controller");
const reviewValidator = require("@validators/review.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/users/reviews/my-reviews
 * @desc    Lấy danh sách đánh giá của người dùng hiện tại
 * @access  Private
 */
router.get("/reviews/my-reviews", reviewController.getUserReviews);

/**
 * @route   POST /api/users/reviews
 * @desc    Tạo đánh giá mới
 * @access  Private
 */
router.post(
  "/reviews",
  validate(reviewValidator.validateCreateReview),
  reviewController.createReview
);

/**
 * @route   PUT /api/users/reviews/:reviewId
 * @desc    Cập nhật đánh giá
 * @access  Private
 */
router.put(
  "/reviews/:reviewId",
  reviewValidator.validateReviewId,
  reviewValidator.validateReviewOwnership,
  validate(reviewValidator.validateUpdateReview),
  reviewController.updateReview
);

/**
 * @route   DELETE /api/users/reviews/:reviewId
 * @desc    Xóa đánh giá (xóa mềm)
 * @access  Private
 */
router.delete(
  "/reviews/:reviewId",
  reviewValidator.validateReviewId,
  reviewValidator.validateReviewOwnership,
  reviewController.deleteReview
);

/**
 * @route   POST /api/users/reviews/:reviewId/like
 * @desc    Thích đánh giá
 * @access  Private
 */
router.post(
  "/reviews/:reviewId/like",
  validate(reviewValidator.validateLikeReview),
  reviewController.likeReview
);

module.exports = router;