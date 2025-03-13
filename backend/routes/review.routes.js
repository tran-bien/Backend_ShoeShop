const express = require("express");
const {
  protect,
  admin,
  optionalAuth,
} = require("../middlewares/auth.middleware");
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
  getReviewStatistics,
} = require("../controllers/review.controller");

const router = express.Router();

// Route công khai - có thể xem đánh giá mà không cần đăng nhập
router.get("/product/:productId", optionalAuth, getProductReviews);
router.get("/statistics/:productId", optionalAuth, getReviewStatistics);

// Route yêu cầu đăng nhập - chỉ người dùng đã đăng nhập mới có thể thêm, cập nhật, xóa đánh giá
router.use(protect);
router.post("/", uploadMultiple, handleUploadError, createReview);
router.get("/user", getUserReviews);
router.put("/:id", updateReview);
router.delete("/:id", deleteReview);
router.post("/:id/like", toggleReviewLike);

// Route dành cho admin
router.get("/all", admin, getAllReviews);
router.patch("/:id/hide", admin, hideReview);

module.exports = router;
