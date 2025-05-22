const express = require("express");
const reviewController = require("@controllers/public/review.controller");
const reviewValidator = require("@validators/review.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/products/:productId/reviews
 * @desc    Lấy danh sách đánh giá của sản phẩm
 * @access  Public
 */
router.get(
  "/:productId/reviews",
  validate(reviewValidator.validateGetProductReviews),
  reviewController.getProductReviews
);

module.exports = router;
