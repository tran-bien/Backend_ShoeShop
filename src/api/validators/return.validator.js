const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Validator cho tạo yêu cầu trả hàng
 * - Trả toàn bộ đơn hàng (không chọn sản phẩm)
 * - Chỉ cần lý do + phương thức hoàn tiền
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

  body("reason")
    .notEmpty()
    .withMessage("Lý do trả hàng không được để trống")
    .isIn([
      "wrong_size",
      "wrong_product",
      "defective",
      "not_as_described",
      "changed_mind",
      "other",
    ])
    .withMessage("Lý do không hợp lệ"),

  body("reasonDetail")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Chi tiết lý do tối đa 500 ký tự"),

  body("refundMethod")
    .notEmpty()
    .withMessage("Phương thức hoàn tiền không được để trống")
    .isIn(["cash", "bank_transfer"])
    .withMessage(
      "Phương thức hoàn tiền không hợp lệ (cash hoặc bank_transfer)"
    ),

  // Validate bankInfo nếu refundMethod = bank_transfer
  body("bankInfo")
    .if(body("refundMethod").equals("bank_transfer"))
    .notEmpty()
    .withMessage("Thông tin ngân hàng không được để trống khi chuyển khoản")
    .isObject()
    .withMessage("Thông tin ngân hàng phải là object"),

  body("bankInfo.bankName")
    .if(body("refundMethod").equals("bank_transfer"))
    .notEmpty()
    .withMessage("Tên ngân hàng không được để trống")
    .isString(),

  body("bankInfo.accountNumber")
    .if(body("refundMethod").equals("bank_transfer"))
    .notEmpty()
    .withMessage("Số tài khoản không được để trống")
    .isString(),

  body("bankInfo.accountName")
    .if(body("refundMethod").equals("bank_transfer"))
    .notEmpty()
    .withMessage("Tên chủ tài khoản không được để trống")
    .isString(),
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
 * Validator cho gán shipper lấy hàng trả
 */
exports.validateAssignShipper = [
  param("id")
    .notEmpty()
    .withMessage("Return Request ID không được để trống")
    .isMongoId()
    .withMessage("Return Request ID không hợp lệ"),

  body("shipperId")
    .notEmpty()
    .withMessage("Shipper ID không được để trống")
    .isMongoId()
    .withMessage("Shipper ID không hợp lệ"),
];

/**
 * Validator cho shipper xác nhận
 */
exports.validateShipperConfirm = [
  param("id")
    .notEmpty()
    .withMessage("Return Request ID không được để trống")
    .isMongoId()
    .withMessage("Return Request ID không hợp lệ"),

  body("note").optional().isString().isLength({ max: 500 }),
];

/**
 * Validator cho admin xác nhận chuyển khoản
 */
exports.validateAdminConfirmTransfer = [
  param("id")
    .notEmpty()
    .withMessage("Return Request ID không được để trống")
    .isMongoId()
    .withMessage("Return Request ID không hợp lệ"),

  body("note").optional().isString().isLength({ max: 500 }),
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
      "shipping",
      "received",
      "refunded",
      "completed",
      "rejected",
      "canceled",
    ])
    .withMessage("Trạng thái không hợp lệ"),

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
