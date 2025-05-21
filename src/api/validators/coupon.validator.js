const { body, param, query } = require("express-validator");
const ApiError = require("@utils/ApiError");
/**
 * Validator cho API thu thập mã giảm giá
 */
const validateCollectCoupon = [
  param("id")
    .notEmpty()
    .withMessage("ID mã giảm giá không được để trống")
    .isMongoId()
    .withMessage("ID mã giảm giá không hợp lệ"),
];

/**
 * Validator cho API lấy chi tiết mã giảm giá
 */
const validateGetCouponDetails = [
  param("id")
    .notEmpty()
    .withMessage("ID mã giảm giá không được để trống")
    .isMongoId()
    .withMessage("ID mã giảm giá không hợp lệ"),
];

// ADMIN VALIDATORS

/**
 * Validator cho API lấy danh sách mã giảm giá (admin)
 */
const validateGetCoupons = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên dương"),
  query("limit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Giới hạn phải là số nguyên dương"),
  query("code").optional().isString().withMessage("Mã giảm giá phải là chuỗi"),
  query("type")
    .optional()
    .isIn(["percent", "fixed"])
    .withMessage("Loại giảm giá không hợp lệ"),
  query("status")
    .optional()
    .isIn(["active", "inactive", "expired", "archived"])
    .withMessage("Trạng thái không hợp lệ"),
  query("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic phải là boolean"),
  query("startDate")
    .optional()
    .isDate()
    .withMessage("Ngày bắt đầu không hợp lệ"),
  query("endDate")
    .optional()
    .isDate()
    .withMessage("Ngày kết thúc không hợp lệ"),
];

/**
 * Validator cho API tạo mã giảm giá
 */
const validateCreateCoupon = [
  body("code")
    .notEmpty()
    .withMessage("Mã giảm giá không được để trống")
    .isString()
    .withMessage("Mã giảm giá phải là chuỗi")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Mã giảm giá phải từ 3-20 ký tự")
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage("Mã giảm giá chỉ được chứa chữ cái và số"),

  body("description")
    .notEmpty()
    .withMessage("Mô tả không được để trống")
    .isString()
    .withMessage("Mô tả phải là chuỗi")
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("Mô tả phải từ 5-500 ký tự"),

  body("type")
    .notEmpty()
    .withMessage("Loại giảm giá không được để trống")
    .isIn(["percent", "fixed"])
    .withMessage("Loại giảm giá không hợp lệ"),

  body("value")
    .notEmpty()
    .withMessage("Giá trị giảm giá không được để trống")
    .isFloat({ min: 0 })
    .withMessage("Giá trị giảm giá phải là số dương"),

  body("maxDiscount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giảm giá tối đa phải là số dương"),

  body("minOrderValue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giá trị đơn hàng tối thiểu phải là số dương"),

  body("startDate")
    .notEmpty()
    .withMessage("Ngày bắt đầu không được để trống")
    .isISO8601()
    .withMessage("Ngày bắt đầu không hợp lệ"),

  body("endDate")
    .notEmpty()
    .withMessage("Ngày kết thúc không được để trống")
    .isISO8601()
    .withMessage("Ngày kết thúc không hợp lệ")
    .custom((endDate, { req }) => {
      const startDate = new Date(req.body.startDate);
      const endDateObj = new Date(endDate);
      if (endDateObj <= startDate) {
        throw new ApiError(400, "Ngày kết thúc phải sau ngày bắt đầu");
      }
      return true;
    }),

  body("maxUses")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Số lượt sử dụng tối đa phải là số nguyên dương hoặc 0"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "expired", "archived"])
    .withMessage("Trạng thái không hợp lệ"),

  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic phải là boolean"),
];

/**
 * Validator cho API cập nhật mã giảm giá
 */
const validateUpdateCoupon = [
  param("id")
    .notEmpty()
    .withMessage("ID không được để trống")
    .isMongoId()
    .withMessage("ID không hợp lệ"),

  body("code")
    .optional()
    .isString()
    .withMessage("Mã giảm giá phải là chuỗi")
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage("Mã giảm giá phải từ 3-20 ký tự")
    .matches(/^[A-Za-z0-9]+$/)
    .withMessage("Mã giảm giá chỉ được chứa chữ cái và số"),

  body("description")
    .optional()
    .isString()
    .withMessage("Mô tả phải là chuỗi")
    .trim()
    .isLength({ min: 5, max: 500 })
    .withMessage("Mô tả phải từ 5-500 ký tự"),

  body("type")
    .optional()
    .isIn(["percent", "fixed"])
    .withMessage("Loại giảm giá không hợp lệ"),

  body("value")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giá trị giảm giá phải là số dương"),

  body("maxDiscount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giảm giá tối đa phải là số dương"),

  body("minOrderValue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Giá trị đơn hàng tối thiểu phải là số dương"),

  body("startDate")
    .optional()
    .isISO8601()
    .withMessage("Ngày bắt đầu không hợp lệ"),

  body("endDate")
    .optional()
    .isISO8601()
    .withMessage("Ngày kết thúc không hợp lệ")
    .custom((endDate, { req }) => {
      if (req.body.startDate) {
        const startDate = new Date(req.body.startDate);
        const endDateObj = new Date(endDate);
        if (endDateObj <= startDate) {
          throw new ApiError(400, "Ngày kết thúc phải sau ngày bắt đầu");
        }
      }
      return true;
    }),

  body("maxUses")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Số lượt sử dụng tối đa phải là số nguyên dương hoặc 0"),

  body("status")
    .optional()
    .isIn(["active", "inactive", "expired", "archived"])
    .withMessage("Trạng thái không hợp lệ"),

  body("isPublic")
    .optional()
    .isBoolean()
    .withMessage("isPublic phải là boolean"),
];

/**
 * Validator cho API cập nhật trạng thái mã giảm giá
 */
const validateUpdateCouponStatus = [
  param("id")
    .notEmpty()
    .withMessage("ID không được để trống")
    .isMongoId()
    .withMessage("ID không hợp lệ"),

  body("status")
    .notEmpty()
    .withMessage("Trạng thái không được để trống")
    .isIn(["active", "inactive", "archived"])
    .withMessage("Trạng thái không hợp lệ"),
];

module.exports = {
  validateCollectCoupon,
  validateGetCouponDetails,
  validateGetCoupons,
  validateCreateCoupon,
  validateUpdateCoupon,
  validateUpdateCouponStatus,
};
