const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const reviewController = require("@controllers/user/review.controller");
const reviewValidator = require("@validators/review.validator");
const validate = require("@utils/validatehelper");
const uploadMiddleware = require("@middlewares/upload.middleware");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/users/reviews/my-reviews
 * @desc    Lấy danh sách đánh giá của người dùng hiện tại
 * @access  Private
 */
router.get("/my-reviews", reviewController.getUserReviews);

/**
 * @route   POST /api/users/reviews
 * @desc    Tạo đánh giá mới (có thể kèm ảnh)
 * @access  Private
 */
router.post(
  "/",
  uploadMiddleware.handleReviewImagesUpload,
  validate(reviewValidator.validateCreateReview),
  reviewController.createReview
);

/**
 * @route   PUT /api/users/reviews/:reviewId
 * @desc    Cập nhật đánh giá (có thể kèm ảnh mới)
 * @access  Private
 */
router.put(
  "/:reviewId",
  uploadMiddleware.handleReviewImagesUpload,
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
  "/:reviewId",
  reviewValidator.validateReviewId,
  reviewValidator.validateReviewOwnership,
  reviewController.deleteReview
);

/**
 * @route   POST /api/users/reviews/:reviewId/like
 * @desc    Thích/bỏ thích đánh giá
 * @access  Private
 */
router.post(
  "/:reviewId/like",
  validate(reviewValidator.validateToggleLikeReview),
  reviewController.toggleLikeReview
);

/**
 * @route   POST /api/users/reviews/:reviewId/images
 * @desc    Thêm ảnh vào đánh giá (bổ sung thêm ảnh)
 * @access  Private
 */
router.post(
  "/:reviewId/images",
  uploadMiddleware.handleReviewImagesUpload,
  reviewValidator.validateReviewId,
  reviewValidator.validateReviewOwnership,
  validate(reviewValidator.validateUploadReviewImages),
  reviewController.uploadReviewImages
);

/**
 * @route   DELETE /api/users/reviews/:reviewId/images
 * @desc    Xóa ảnh khỏi đánh giá
 * @access  Private
 */
router.delete(
  "/:reviewId/images",
  reviewValidator.validateReviewId,
  reviewValidator.validateReviewOwnership,
  validate(reviewValidator.validateImageIds),
  reviewController.removeReviewImages
);

module.exports = router;
