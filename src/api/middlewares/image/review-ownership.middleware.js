const asyncHandler = require("express-async-handler");
const { Review } = require("@models");

// Middleware kiểm tra người dùng có quyền sở hữu review hay không
exports.checkReviewOwnership = asyncHandler(async (req, res, next) => {
  const reviewId = req.params.modelId; // modelId chính là reviewId trong route
  const userId = req.user._id;

  const review = await Review.findById(reviewId);

  if (!review) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy đánh giá",
    });
  }

  // Kiểm tra nếu người dùng không phải chủ sở hữu của review
  if (review.user.toString() !== userId.toString()) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thao tác với đánh giá này",
    });
  }

  // Lưu review vào request để tái sử dụng nếu cần
  req.review = review;
  next();
});
