const express = require("express");
const reviewController = require("@controllers/public/review.controller");
const reviewValidator = require("@validators/review.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/reviews/:id
 * @desc    Lấy chi tiết đánh giá
 * @access  Public
 */
router.get(
  "/:id",
  validate(reviewValidator.validateGetReviewDetail),
  reviewController.getReviewDetail
);

module.exports = router;
