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

/**
 * Custom validator cho slug format
 */
const isValidSlug = (value) => {
  if (value && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error("Slug phải chỉ chứa chữ thường, số và dấu gạch ngang");
  }
  return true;
};

/**
 * Custom middleware để thêm thông tin người dùng và timestamp
 * @param {*} req - Request object
 * @param {*} res - Response object
 * @param {*} next - Next function
 */
const addAuditInfo = (req, res, next) => {
  // Chỉ áp dụng cho các phương thức thay đổi dữ liệu
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    // Format ngày giờ: YYYY-MM-DD HH:MM:SS
    const now = new Date();
    const formattedDate = now.toISOString().slice(0, 19).replace("T", " ");

    // Lấy thông tin người dùng từ req.user
    const username = req.user ? req.user.username || req.user.email : "system";

    // Thêm thông tin vào req.body
    if (req.method === "POST") {
      req.body.createdAt = formattedDate;
      req.body.createdBy = username;
    }

    req.body.updatedAt = formattedDate;
    req.body.updatedBy = username;
  }

  next();
};

// Validation chung cho cả admin và public
const commonValidators = {
  /**
   * Validator cho ID danh mục
   */
  validateCategoryId: [
    param("id").custom(isValidObjectId).withMessage("ID danh mục không hợp lệ"),
  ],

  /**
   * Validator cho slug danh mục
   */
  validateCategorySlug: [
    param("slug")
      .notEmpty()
      .withMessage("Slug không được để trống")
      .isLength({ min: 2, max: 100 })
      .withMessage("Slug phải từ 2-100 ký tự")
      .custom(isValidSlug),
  ],
};

// Validation chỉ dành cho admin
const adminValidators = {
  /**
   * Validator cho tạo/cập nhật danh mục (Admin)
   */
  validateCategoryData: [
    body("name")
      .notEmpty()
      .withMessage("Tên danh mục là bắt buộc")
      .isLength({ min: 2, max: 100 })
      .withMessage("Tên danh mục phải từ 2-100 ký tự")
      .trim(),

    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Mô tả không được vượt quá 500 ký tự")
      .trim(),

    // isActive là optional khi tạo, mặc định là true
    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái hoạt động phải là true hoặc false"),

    addAuditInfo, // Thêm audit info vào sau khi validate
  ],

  /**
   * Validator cho các tham số truy vấn admin (bao gồm isActive)
   */
  validateCategoryQuery: [
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
      .withMessage("Tên tìm kiếm phải là chuỗi")
      .trim(),

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
    param("id").custom(isValidObjectId).withMessage("ID danh mục không hợp lệ"),

    body("isActive")
      .exists()
      .withMessage("Thiếu thông tin trạng thái")
      .isBoolean()
      .withMessage("Trạng thái phải là true hoặc false"),

    body("cascade")
      .optional()
      .isBoolean()
      .withMessage("Cascade phải là true hoặc false")
      .toBoolean(),

    addAuditInfo, // Thêm audit info vào sau khi validate
  ],
};

// Validation chỉ dành cho public API
const publicValidators = {
  /**
   * Validator cho query phía public (không có isActive)
   */
  validatePublicCategoryQuery: [
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
      .withMessage("Tên tìm kiếm phải là chuỗi")
      .trim(),
  ],
};

module.exports = {
  ...commonValidators,
  ...adminValidators,
  ...publicValidators,
};
