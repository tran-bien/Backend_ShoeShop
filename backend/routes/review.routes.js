const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  uploadMultiple,
  handleUploadError,
} = require("../middlewares/upload.middleware");
const {
  createReview,
  getUserReviews,
  getProductReviews,
  toggleReviewLike,
  hideReview,
  updateReview,
  deleteReview,
  getAllReviews,
} = require("../controllers/review.controller");

const router = express.Router();

// Route công khai - không yêu cầu xác thực
router.get("/product/:productId", getProductReviews);

// Tất cả các route còn lại đều yêu cầu xác thực
router.use(protect);

// Route đánh giá - yêu cầu đăng nhập
router.post("/", uploadMultiple, handleUploadError, createReview);
router.get("/my-reviews", getUserReviews);
router.post("/:reviewId/like", toggleReviewLike);

// Route cho admin
router.get("/all", admin, getAllReviews);
router.put("/:reviewId/hide", admin, hideReview);
router.put("/:id", updateReview);
router.delete("/:id", deleteReview);

module.exports = router;
