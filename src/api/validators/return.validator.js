const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Validator cho tạo yêu cầu đổi/trả
 */
exports.validateCreateReturnRequest = [
  body("orderId")
    .notEmpty()
    .withMessage("Order ID không được để trống")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Order ID không hợp lệ");
      }
      return true;
    }),

  body("type")
    .notEmpty()
    .withMessage("Loại yêu cầu không được để trống")
    .isIn(["RETURN", "EXCHANGE"])
    .withMessage("Loại phải là: RETURN hoặc EXCHANGE"),

  body("items")
    .notEmpty()
    .withMessage("Danh sách sản phẩm không được để trống")
    .isArray({ min: 1 })
    .withMessage("Phải có ít nhất 1 sản phẩm"),

  body("items.*.variant")
    .notEmpty()
    .withMessage("Variant ID không được để trống")
    .isMongoId()
    .withMessage("Variant ID không hợp lệ"),

  body("items.*.size")
    .notEmpty()
    .withMessage("Size ID không được để trống")
    .isMongoId()
    .withMessage("Size ID không hợp lệ"),

  body("items.*.quantity")
    .notEmpty()
    .withMessage("Số lượng không được để trống")
    .isInt({ min: 1 })
    .withMessage("Số lượng phải là số nguyên dương")
    .custom((value, { req }) => {
      // Nếu là EXCHANGE, chỉ cho phép quantity = 1
      if (req.body.type === "EXCHANGE" && value !== 1) {
        throw new Error("Đổi hàng chỉ được phép đổi 1 sản phẩm mỗi lần");
      }
      return true;
    }),

  body("items.*.reason")
    .notEmpty()
    .withMessage("Lý do không được để trống")
    .isString(),

  body("items.*.images")
    .optional()
    .isArray()
    .withMessage("Images phải là array"),

  body("items.*.exchangeToVariant")
    .optional()
    .isMongoId()
    .withMessage("Exchange Variant ID không hợp lệ")
    .custom((value, { req }) => {
      // Nếu type là EXCHANGE, exchangeToVariant là required
      const itemIndex = req.body.items?.findIndex(
        (item) => item.exchangeToVariant === value
      );
      if (req.body.type === "EXCHANGE") {
        if (!value) {
          throw new Error("Phải chọn variant để đổi sang");
        }
        // Kiểm tra exchangeToVariant phải GIỐNG với variant gốc (chỉ đổi size)
        const item = req.body.items[itemIndex];
        if (item && item.variant && value !== item.variant) {
          throw new Error(
            "Chỉ được đổi sang size khác, không được đổi màu sắc hoặc sản phẩm"
          );
        }
      }
      return true;
    }),

  body("items.*.exchangeToSize")
    .optional()
    .isMongoId()
    .withMessage("Exchange Size ID không hợp lệ")
    .custom((value, { req }) => {
      // Nếu type là EXCHANGE, exchangeToSize là required
      const itemIndex = req.body.items?.findIndex(
        (item) => item.exchangeToSize === value
      );
      if (req.body.type === "EXCHANGE") {
        if (!value) {
          throw new Error("Phải chọn size để đổi sang");
        }
        // Kiểm tra exchangeToSize phải KHÁC với size gốc
        const item = req.body.items[itemIndex];
        if (item && item.size && value === item.size) {
          throw new Error("Size đổi sang phải khác với size hiện tại");
        }
      }
      return true;
    }),

  body("reason")
    .notEmpty()
    .withMessage("Lý do chung không được để trống")
    .isString(),

  body("refundMethod")
    .optional()
    .isIn(["original_payment", "store_credit", "bank_transfer"])
    .withMessage("Phương thức hoàn tiền không hợp lệ"),

  body("bankInfo")
    .optional()
    .isObject()
    .withMessage("Thông tin ngân hàng phải là object"),

  body("bankInfo.bankName")
    .optional()
    .isString()
    .withMessage("Tên ngân hàng không được để trống"),

  body("bankInfo.accountNumber")
    .optional()
    .isString()
    .withMessage("Số tài khoản không được để trống"),

  body("bankInfo.accountName")
    .optional()
    .isString()
    .withMessage("Tên chủ tài khoản không được để trống"),
];

/**
 * Validator cho phê duyệt yêu cầu
 */
exports.validateApproveReturn = [
  param("id")
    .notEmpty()
    .withMessage("Return Request ID không được để trống")
    .isMongoId()
    .withMessage("Return Request ID không hợp lệ"),

  body("note").optional().isString(),
];

/**
 * Validator cho từ chối yêu cầu
 */
exports.validateRejectReturn = [
  param("id")
    .notEmpty()
    .withMessage("Return Request ID không được để trống")
    .isMongoId()
    .withMessage("Return Request ID không hợp lệ"),

  body("reason")
    .notEmpty()
    .withMessage("Lý do từ chối không được để trống")
    .isString()
    .isLength({ min: 10, max: 500 })
    .withMessage("Lý do từ chối phải từ 10-500 ký tự"),
];

/**
 * Validator cho xử lý trả hàng
 */
exports.validateProcessReturn = [
  param("id")
    .notEmpty()
    .withMessage("Return Request ID không được để trống")
    .isMongoId()
    .withMessage("Return Request ID không hợp lệ"),

  body("note").optional().isString(),
];

/**
 * Validator cho query danh sách
 */
exports.validateGetReturns = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số trang phải là số nguyên dương"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Số lượng mỗi trang phải từ 1-100"),

  query("status")
    .optional()
    .isIn([
      "pending",
      "approved",
      "rejected",
      "processing",
      "completed",
      "cancelled",
    ])
    .withMessage("Trạng thái không hợp lệ"),

  query("type")
    .optional()
    .isIn(["RETURN", "EXCHANGE"])
    .withMessage("Loại phải là: RETURN hoặc EXCHANGE"),

  query("customerId")
    .optional()
    .isMongoId()
    .withMessage("Customer ID không hợp lệ"),
];

/**
 * Validator cho return ID
 */
exports.validateReturnId = [
  param("id")
    .notEmpty()
    .withMessage("Return Request ID không được để trống")
    .isMongoId()
    .withMessage("Return Request ID không hợp lệ"),
];

/**
 * Validator cho check exchange eligibility
 */
exports.validateCheckEligibility = [
  query("orderId")
    .notEmpty()
    .withMessage("Order ID không được để trống")
    .isMongoId()
    .withMessage("Order ID không hợp lệ"),

  query("variantId")
    .notEmpty()
    .withMessage("Variant ID không được để trống")
    .isMongoId()
    .withMessage("Variant ID không hợp lệ"),

  query("sizeId")
    .notEmpty()
    .withMessage("Size ID không được để trống")
    .isMongoId()
    .withMessage("Size ID không hợp lệ"),
];
