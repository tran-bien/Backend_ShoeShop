const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");
const { Review } = require("@models");
const ApiError = require("@utils/ApiError");
/**
 * Validator cho API lấy danh sách đánh giá theo sản phẩm
 */
const validateGetProductReviews = [
  param("productId")
    .notEmpty()
    .withMessage("ID sản phẩm không được để trống")
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên dương"),
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Giới hạn phải là số nguyên dương"),
  query("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Đánh giá phải là số nguyên từ 1-5"),
  query("sort").optional().isString().withMessage("Sắp xếp phải là chuỗi"),
];

/**
 * Validator cho API lấy chi tiết đánh giá
 */
const validateGetReviewDetail = [
  param("id")
    .notEmpty()
    .withMessage("ID đánh giá không được để trống")
    .isMongoId()
    .withMessage("ID đánh giá không hợp lệ"),
];

/**
 * Kiểm tra ID có phải là MongoDB ObjectId hợp lệ không
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "ID không hợp lệ");
  }
  return true;
};

/**
 * Kiểm tra mảng ID có đúng định dạng MongoDB ObjectId không
 */
const areValidObjectIds = (value) => {
  if (!Array.isArray(value)) {
    throw new ApiError(400, "Phải là một mảng các ID");
  }

  if (!value.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw new ApiError(400, "Có ID không hợp lệ trong danh sách");
  }

  return true;
};

/**
 * Validator cho API tạo đánh giá
 */
const validateCreateReview = [
  body("orderItemId")
    .notEmpty()
    .withMessage("ID sản phẩm trong đơn hàng không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID sản phẩm trong đơn hàng không hợp lệ"),
  body("orderId")
    .notEmpty()
    .withMessage("ID đơn hàng không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID đơn hàng không hợp lệ"),
  body("rating")
    .notEmpty()
    .withMessage("Đánh giá sao không được để trống")
    .isInt({ min: 1, max: 5 })
    .withMessage("Đánh giá phải từ 1-5 sao"),
  body("title")
    .notEmpty()
    .withMessage("Tiêu đề đánh giá không được để trống")
    .isLength({ min: 3, max: 100 })
    .withMessage("Tiêu đề đánh giá phải từ 3-100 ký tự"),
  body("content")
    .notEmpty()
    .withMessage("Nội dung đánh giá không được để trống")
    .isLength({ min: 10, max: 1500 })
    .withMessage("Nội dung đánh giá phải từ 10-1500 ký tự"),
  body("images").optional().isArray().withMessage("Ảnh phải là một mảng"),
  body("images.*.url").optional().isURL().withMessage("URL ảnh không hợp lệ"),
  body("images.*.public_id")
    .optional()
    .isString()
    .withMessage("Public ID ảnh không hợp lệ"),
];

/**
 * Validator cho API cập nhật đánh giá
 */
const validateUpdateReview = [
  body("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Đánh giá phải từ 1-5 sao"),
  body("content")
    .optional()
    .isLength({ min: 10, max: 1500 })
    .withMessage("Nội dung đánh giá phải từ 10-1500 ký tự"),
  body("images").optional().isArray().withMessage("Ảnh phải là một mảng"),
  body("images.*.url").optional().isURL().withMessage("URL ảnh không hợp lệ"),
  body("images.*.public_id")
    .optional()
    .isString()
    .withMessage("Public ID ảnh không hợp lệ"),
];

/**
 * Validator cho API thích/bỏ thích đánh giá
 */
const validateToggleLikeReview = [
  param("reviewId")
    .notEmpty()
    .withMessage("ID đánh giá không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID đánh giá không hợp lệ"),
];

// ADMIN VALIDATORS

/**
 * Validator cho API lấy danh sách đánh giá (admin)
 */
const validateGetAllReviews = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên dương"),
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Giới hạn phải là số nguyên dương"),
  query("productId")
    .optional()
    .isMongoId()
    .withMessage("ID sản phẩm không hợp lệ"),
  query("userId")
    .optional()
    .isMongoId()
    .withMessage("ID người dùng không hợp lệ"),
  query("rating")
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage("Đánh giá phải là số nguyên từ 1-5"),
  query("isVerified")
    .optional()
    .isBoolean()
    .withMessage("isVerified phải là boolean"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive phải là boolean"),
  query("showDeleted")
    .optional()
    .isBoolean()
    .withMessage("showDeleted phải là boolean"),
  query("sort").optional().isString().withMessage("Sắp xếp phải là chuỗi"),
];

/**
 * Validator cho API cập nhật trạng thái hiển thị của đánh giá
 */
const validateToggleReviewVisibility = [
  param("id")
    .notEmpty()
    .withMessage("ID đánh giá không được để trống")
    .isMongoId()
    .withMessage("ID đánh giá không hợp lệ"),
  body("isActive")
    .notEmpty()
    .withMessage("Trạng thái hiển thị không được để trống")
    .isBoolean()
    .withMessage("Trạng thái hiển thị phải là boolean"),
];

/**
 * Validator cho API khôi phục đánh giá
 */
const validateRestoreReview = [
  param("id")
    .notEmpty()
    .withMessage("ID đánh giá không được để trống")
    .isMongoId()
    .withMessage("ID đánh giá không hợp lệ"),
];

/**
 * Validator cho upload ảnh review
 */
const validateUploadReviewImages = [
  // Kiểm tra tồn tại của file
  (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      throw new ApiError(400, "Không có ảnh nào được tải lên");
    }
    next();
  },

  // Kiểm tra số lượng ảnh tối đa
  (req, res, next) => {
    if (req.files.length > 5) {
      throw new ApiError(
        400,
        "Chỉ được phép tải lên tối đa 5 ảnh cho mỗi đánh giá"
      );
    }
    next();
  },
];

/**
 * Validator cho ID review
 */
const validateReviewId = [
  param("reviewId")
    .custom(isValidObjectId)
    .withMessage("ID đánh giá không hợp lệ"),
];

/**
 * Validator kiểm tra review thuộc người dùng hiện tại
 */
const validateReviewOwnership = async (req, res, next) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user._id;

    const review = await Review.findOne({
      _id: reviewId,
      user: userId,
      deletedAt: null,
    });

    if (!review) {
      throw new ApiError(403, "Bạn không có quyền thao tác với đánh giá này");
    }

    // Lưu thông tin review vào request để sử dụng sau này
    req.review = review;
    next();
  } catch (error) {
    throw new ApiError(500, "Lỗi kiểm tra quyền sở hữu đánh giá");
  }
};

/**
 * Validator cho imageIds
 */
const validateImageIds = [
  body("imageIds")
    .isArray({ min: 1 })
    .withMessage("Vui lòng cung cấp ít nhất một ID ảnh")
    .custom(areValidObjectIds)
    .withMessage("Có ID ảnh không hợp lệ trong danh sách"),
];

module.exports = {
  validateGetProductReviews,
  validateGetReviewDetail,
  validateCreateReview,
  validateUpdateReview,
  validateToggleLikeReview,
  validateGetAllReviews,
  validateToggleReviewVisibility,
  validateRestoreReview,
  validateUploadReviewImages,
  validateReviewId,
  validateReviewOwnership,
  validateImageIds,
};
