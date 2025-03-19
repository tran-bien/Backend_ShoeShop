const asyncHandler = require("express-async-handler");
const imageService = require("@services/image.service");

/**
 * @desc    Upload ảnh đại diện cho người dùng đã đăng nhập
 * @route   POST /api/images/avatar
 * @access  Private
 */
exports.uploadAvatar = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Không có file ảnh nào được tải lên",
    });
  }

  const avatarData = {
    url: req.file.path,
    public_id: req.file.filename,
  };

  // Lấy userId từ người dùng đang đăng nhập
  const userId = req.user._id;

  const result = await imageService.updateUserAvatar(userId, avatarData);

  res.json(result);
});

/**
 * @desc    Xóa ảnh đại diện của người dùng đã đăng nhập
 * @route   DELETE /api/images/avatar
 * @access  Private
 */
exports.removeAvatar = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const result = await imageService.removeUserAvatar(userId);

  res.json(result);
});

/**
 * @desc    Upload ảnh cho review
 * @route   POST /api/images/review/:reviewId
 * @access  Private
 */
exports.uploadReviewImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Không có file nào được tải lên",
    });
  }

  const reviewId = req.params.reviewId;

  // review đã được kiểm tra quyền sở hữu trong middleware
  if (!req.review) {
    return res.status(500).json({
      success: false,
      message: "Lỗi xử lý quyền sở hữu review",
    });
  }

  const results = req.files.map((file, index) => ({
    url: file.path,
    public_id: file.filename,
  }));

  const updatedReview = await imageService.updateModelImages(
    "review",
    reviewId,
    results
  );

  res.json({
    success: true,
    message: "Tải lên ảnh review thành công",
    data: updatedReview,
  });
});

/**
 * @desc    Xóa ảnh của review
 * @route   DELETE /api/images/review/:reviewId
 * @access  Private
 */
exports.removeReviewImages = asyncHandler(async (req, res) => {
  const { reviewId } = req.params;
  const { imageIds } = req.body;

  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp danh sách ID ảnh cần xóa",
    });
  }

  // review đã được kiểm tra quyền sở hữu trong middleware
  if (!req.review) {
    return res.status(500).json({
      success: false,
      message: "Lỗi xử lý quyền sở hữu review",
    });
  }

  const result = await imageService.removeImagesFromModel(
    "review",
    reviewId,
    imageIds
  );

  res.json(result);
});
