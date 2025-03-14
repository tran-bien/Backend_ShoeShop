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
  toggleLikeReview,
  hideReview,
  updateReview,
  deleteReview,
  getAllReviews,
  getReviewStatistics,
  getReviewDetail,
  adminUpdateReview,
  checkReviewEligibility,
} = require("../controllers/review.controller");

const router = express.Router();

// Route công khai - có thể xem đánh giá mà không cần đăng nhập
router.get("/product/:productId", getProductReviews);
router.get("/statistics/:productId", getReviewStatistics);

// Route yêu cầu đăng nhập - chỉ người dùng đã đăng nhập mới có thể thêm, cập nhật, xóa đánh giá
router.use(protect);
router.post("/", uploadMultiple, handleUploadError, createReview);
router.get("/user", getUserReviews);
router.put("/:id", updateReview);
router.delete("/:id", deleteReview);
router.post("/:id/like", toggleLikeReview);
router.get("/check-eligibility/:productId", checkReviewEligibility);

// Route dành cho admin
router.get("/all", admin, getAllReviews);
router.patch("/:id/hide", admin, hideReview);
router.get("/:id", getReviewDetail);
router.put("/admin/:id", adminUpdateReview);

module.exports = router;
