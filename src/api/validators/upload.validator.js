const { body, param } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Kiểm tra ID có phải là MongoDB ObjectId hợp lệ không
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new Error("ID không hợp lệ");
  }
  return true;
};

/**
 * Kiểm tra mảng ID có đúng định dạng MongoDB ObjectId không
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

// Validator chi tiết theo từng thao tác
const uploadValidator = {
  /**
   * Validator cho brandId
   */
  validateBrandId: [
    param("brandId")
      .custom(isValidObjectId)
      .withMessage("ID thương hiệu không hợp lệ"),
  ],

  /**
   * Validator cho productId
   */
  validateProductId: [
    param("productId")
      .custom(isValidObjectId)
      .withMessage("ID sản phẩm không hợp lệ"),
  ],

  /**
   * Validator cho variantId
   */
  validateVariantId: [
    param("variantId")
      .custom(isValidObjectId)
      .withMessage("ID biến thể không hợp lệ"),
  ],

  /**
   * Validator cho xóa ảnh
   */
  validateImageIds: [
    body("imageIds")
      .isArray({ min: 1 })
      .withMessage("Vui lòng cung cấp ít nhất một ID ảnh")
      .custom(areValidObjectIds)
      .withMessage("Có ID ảnh không hợp lệ trong danh sách"),
  ],

  /**
   * Validator cho sắp xếp ảnh
   */
  validateImageOrders: [
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
   * Validator cho đặt ảnh chính
   */
  validateMainImage: [
    body("imageId")
      .notEmpty()
      .withMessage("Vui lòng cung cấp ID ảnh")
      .custom(isValidObjectId)
      .withMessage("ID ảnh không hợp lệ"),
  ],

  /**
   * Validator cho kiểm tra tệp đã được upload (single)
   */
  validateSingleFileExists: [
    body().custom((_, { req }) => {
      if (!req.file) {
        throw new Error("Không có file nào được tải lên");
      }
      return true;
    }),
  ],

  /**
   * Validator cho kiểm tra tệp đã được upload (multi)
   */
  validateMultipleFilesExist: [
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) {
        throw new Error("Không có file nào được tải lên");
      }
      return true;
    }),
  ],

  /**
   * Validator cho xóa ảnh từ Cloudinary (hỗ trợ publicId hoặc publicIds)
   */
  validateCloudinaryDelete: [
    // Nếu người dùng cung cấp publicIds thì nó phải là mảng
    body("publicIds")
      .optional()
      .isArray()
      .withMessage("Dữ liệu các mã file cần xóa không đúng định dạng"),

    // Nếu có publicIds, mỗi phần tử phải là chuỗi không rỗng
    body("publicIds.*")
      .optional()
      .isString()
      .withMessage("Mỗi mã file cần xóa phải là văn bản hợp lệ")
      .notEmpty()
      .withMessage("Mã file không được để trống"),

    // Nếu cung cấp publicId thì phải là chuỗi không rỗng
    body("publicId")
      .optional()
      .isString()
      .withMessage("Mã file cần xóa phải là văn bản hợp lệ")
      .notEmpty()
      .withMessage("Mã file không được để trống"),

    // Custom validator: phải có ít nhất một trong số các trường (publicIds hoặc publicId)
    body().custom((_, { req }) => {
      if (
        (!req.body.publicIds || req.body.publicIds.length === 0) &&
        !req.body.publicId
      ) {
        throw new Error("Vui lòng cung cấp ít nhất một mã file cần xóa");
      }
      return true;
    }),
  ],
};

module.exports = uploadValidator;
