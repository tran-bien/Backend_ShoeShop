const asyncHandler = require("express-async-handler");
const reviewService = require("@services/review.service");
const imageService = require("@services/image.service");

const reviewController = {
  /**
   * @desc    Lấy danh sách đánh giá của người dùng hiện tại
   * @route   GET /api/users/reviews/my-reviews
   * @access  Private
   */
  getUserReviews: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await reviewService.getUserReviews(userId, req.query);
    res.json(result);
  }),

  /**
   * @desc    Tạo đánh giá sản phẩm mới
   * @route   POST /api/users/reviews
   * @access  Private
   */
  createReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Chuẩn bị dữ liệu review
    const reviewData = { ...req.body };

    // Nếu có files được upload, thêm vào reviewData
    if (req.files && req.files.length > 0) {
      reviewData.images = req.files.map((file) => ({
        url: file.path,
        public_id: file.filename,
      }));
    }

    const result = await reviewService.createReview(userId, reviewData);
    res.status(201).json(result);
  }),

  /**
   * @desc    Cập nhật đánh giá
   * @route   PUT /api/users/reviews/:reviewId
   * @access  Private
   */
  updateReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;

    // Chuẩn bị dữ liệu cập nhật
    const updateData = { ...req.body };

    // Nếu có files được upload, thêm vào updateData
    if (req.files && req.files.length > 0) {
      updateData.newImages = req.files.map((file) => ({
        url: file.path,
        public_id: file.filename,
      }));
    }

    const result = await reviewService.updateReview(
      userId,
      reviewId,
      updateData
    );
    res.json(result);
  }),

  /**
   * @desc    Xóa đánh giá
   * @route   DELETE /api/users/reviews/:reviewId
   * @access  Private
   */
  deleteReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;
    const result = await reviewService.deleteReview(userId, reviewId);
    res.json(result);
  }),

  /**
   * @desc    Thích/bỏ thích đánh giá
   * @route   POST /api/users/reviews/:reviewId/like
   * @access  Private
   */
  toggleLikeReview: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;
    const result = await reviewService.toggleLikeReview(userId, reviewId);
    res.json(result);
  }),

  /**
   * @desc    Upload ảnh cho đánh giá
   * @route   POST /api/users/reviews/:reviewId/images
   * @access  Private
   */
  uploadReviewImages: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;

    // Kiểm tra quyền sở hữu review trước khi thêm ảnh
    await reviewService.checkReviewOwnership(userId, reviewId);

    // Chuẩn bị dữ liệu ảnh từ files đã upload
    const images = req.files.map((file) => ({
      url: file.path,
      public_id: file.filename,
    }));

    // Thêm ảnh vào review
    const result = await imageService.addReviewImages(reviewId, images);
    res.status(200).json(result);
  }),

  /**
   * @desc    Xóa ảnh khỏi đánh giá
   * @route   DELETE /api/users/reviews/:reviewId/images
   * @access  Private
   */
  removeReviewImages: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { reviewId } = req.params;
    const { imageIds } = req.body;

    // Kiểm tra quyền sở hữu review trước khi xóa ảnh
    await reviewService.checkReviewOwnership(userId, reviewId);

    // Xóa ảnh từ review
    const result = await imageService.removeReviewImages(reviewId, imageIds);
    res.status(200).json(result);
  }),
};

module.exports = reviewController;
