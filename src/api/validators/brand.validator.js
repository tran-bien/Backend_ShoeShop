const { body, param, query } = require("express-validator");
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

const brandValidator = {
  /**
   * Validator cho ID thương hiệu
   */
  validateBrandId: [
    param("id")
      .custom(isValidObjectId)
      .withMessage("ID thương hiệu không hợp lệ"),
  ],

  /**
   * Validator cho tạo/cập nhật thương hiệu
   */
  validateBrandData: [
    body("name")
      .notEmpty()
      .withMessage("Tên thương hiệu là bắt buộc")
      .isLength({ min: 2, max: 100 })
      .withMessage("Tên thương hiệu phải từ 2-100 ký tự")
      .trim(),

    body("description")
      .optional()
      .isLength({ max: 1000 })
      .withMessage("Mô tả không được vượt quá 1000 ký tự")
      .trim(),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái hoạt động phải là true hoặc false"),
  ],

  /**
   * Validator cho các tham số truy vấn
   */
  validateBrandQuery: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Trang phải là số nguyên dương")
      .toInt(),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Số lượng mỗi trang phải từ 1-100")
      .toInt(),

    query("sort").optional().isString().withMessage("Sắp xếp phải là chuỗi"),

    query("name")
      .optional()
      .isString()
      .withMessage("Tên tìm kiếm phải là chuỗi"),

    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái phải là true hoặc false")
      .toBoolean(),
  ],

  /**
   * Validator cho cập nhật trạng thái
   */
  validateStatusUpdate: [
    param("id")
      .custom(isValidObjectId)
      .withMessage("ID thương hiệu không hợp lệ"),

    body("isActive")
      .exists()
      .withMessage("Thiếu thông tin trạng thái")
      .notEmpty()
      .withMessage("Thông tin trạng thái không được để trống")
      .isBoolean()
      .withMessage("Trạng thái phải là true hoặc false"),
  ],
};

module.exports = brandValidator;
