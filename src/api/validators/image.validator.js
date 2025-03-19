const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Kiểm tra ID có phải là MongoDB ObjectId hợp lệ không
 * @param {String} value - ID cần kiểm tra
 * @returns {Boolean} - true nếu ID hợp lệ
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error("ID không hợp lệ");
  }
  return true;
};

/**
 * Kiểm tra mảng ID có đúng định dạng MongoDB ObjectId không
 * @param {Array} value - Mảng ID cần kiểm tra
 * @returns {Boolean} - true nếu tất cả ID hợp lệ
 */
const areValidObjectIds = (value) => {
  if (!Array.isArray(value)) {
    throw new Error("Phải là một mảng các ID");
  }

  if (!value.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    throw new Error("Có ID không hợp lệ trong danh sách");
  }

  return true;
};

/**
 * Validator kiểm tra model type
 * @param {String} value - Loại model
 * @param {Array} allowedTypes - Mảng các loại model được phép
 * @returns {Boolean} - true nếu loại model hợp lệ
 */
const isValidModelType = (value, allowedTypes) => {
  if (!allowedTypes.includes(value)) {
    const typesString = allowedTypes.join(", ");
    throw new Error(`Loại model phải là một trong các giá trị: ${typesString}`);
  }
  return true;
};

// Validators hoàn chỉnh
const imageValidator = {
  /**
   * Validator cho tải lên ảnh model
   */
  validateUploadImages: [
    param("modelType")
      .custom((value) =>
        isValidModelType(value, ["product", "variant", "brand", "review"])
      )
      .withMessage("Loại model không hợp lệ"),

    param("modelId")
      .custom(isValidObjectId)
      .withMessage("ID model không hợp lệ"),

    body().custom((_, { req }) => {
      if (!req.files) {
        throw new Error("Không tìm thấy file ảnh để tải lên");
      }
      return true;
    }),
  ],

  /**
   * Validator cho xóa ảnh model
   */
  validateRemoveImages: [
    param("modelType")
      .custom((value) =>
        isValidModelType(value, ["product", "variant", "brand", "review"])
      )
      .withMessage("Loại model không hợp lệ"),

    param("modelId")
      .custom(isValidObjectId)
      .withMessage("ID model không hợp lệ"),

    body("imageIds")
      .isArray({ min: 1 })
      .withMessage("Vui lòng cung cấp ít nhất một ID ảnh")
      .custom(areValidObjectIds)
      .withMessage("Có ID ảnh không hợp lệ trong danh sách"),
  ],

  /**
   * Validator cho sắp xếp thứ tự ảnh
   */
  validateReorderImages: [
    param("modelType")
      .custom((value) => isValidModelType(value, ["product", "variant"]))
      .withMessage("Chỉ hỗ trợ sắp xếp ảnh cho sản phẩm và biến thể"),

    param("modelId")
      .custom(isValidObjectId)
      .withMessage("ID model không hợp lệ"),

    body("imageOrders")
      .isArray({ min: 1 })
      .withMessage("Vui lòng cung cấp ít nhất một thứ tự ảnh"),

    body("imageOrders.*.displayOrder")
      .isInt({ min: 0 })
      .withMessage("Thứ tự hiển thị phải là số nguyên không âm"),

    body("imageOrders.*._id")
      .custom(isValidObjectId)
      .withMessage("ID ảnh không hợp lệ"),
  ],

  /**
   * Validator cho thiết lập ảnh chính
   */
  validateSetMainImage: [
    param("modelType")
      .custom((value) => isValidModelType(value, ["product", "variant"]))
      .withMessage("Chỉ hỗ trợ đặt ảnh chính cho sản phẩm và biến thể"),

    param("modelId")
      .custom(isValidObjectId)
      .withMessage("ID model không hợp lệ"),

    body("imageId")
      .notEmpty()
      .withMessage("Vui lòng cung cấp ID ảnh")
      .custom(isValidObjectId)
      .withMessage("ID ảnh không hợp lệ"),
  ],

  /**
   * Validator cho tham số userId
   */
  validateUserIdParam: [
    param("userId")
      .custom(isValidObjectId)
      .withMessage("ID người dùng không hợp lệ"),
  ],

  /**
   * Validator cho tham số reviewId
   */
  validateReviewIdParam: [
    param("reviewId")
      .custom(isValidObjectId)
      .withMessage("ID đánh giá không hợp lệ"),
  ],

  /**
   * Validator cho xóa ảnh từ Cloudinary
   */
  validateDeleteFromCloudinary: [
    body().custom((body) => {
      const { publicIds, publicId } = body;
      if ((!publicIds || !publicIds.length) && !publicId) {
        throw new Error("Vui lòng cung cấp ít nhất một publicId để xóa");
      }
      return true;
    }),
  ],

  /**
   * Validator cho kiểm tra upload avatar
   */
  validateAvatarUpload: [
    body().custom((_, { req }) => {
      if (!req.file) {
        throw new Error("Vui lòng tải lên một ảnh đại diện");
      }
      return true;
    }),
  ],

  /**
   * Validator cho đầu vào review image
   */
  validateReviewImages: [
    param("reviewId")
      .custom(isValidObjectId)
      .withMessage("ID đánh giá không hợp lệ"),

    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) {
        throw new Error("Vui lòng tải lên ít nhất một ảnh");
      }

      if (req.files.length > 5) {
        throw new Error("Chỉ được tải lên tối đa 5 ảnh cho mỗi đánh giá");
      }

      return true;
    }),
  ],

  /**
   * Validator cho kiểm tra tệp đã được upload
   */
  validateFileExists: [
    body().custom((_, { req }) => {
      // Kiểm tra tùy thuộc vào loại request (single file hoặc multiple files)
      if (req.file === undefined && (!req.files || req.files.length === 0)) {
        throw new Error("Không có file nào được tải lên");
      }
      return true;
    }),
  ],
};

module.exports = imageValidator;
