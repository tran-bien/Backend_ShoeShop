const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

/**
 * Kiểm tra ID có phải là MongoDB ObjectID hợp lệ
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "ID đơn hàng không hợp lệ");
  }
  return true;
};

/**
 * Validate dữ liệu khi tạo đơn hàng mới
 */
const validateCreateOrder = [
  body("addressId")
    .notEmpty()
    .withMessage("Địa chỉ không được để trống")
    .isMongoId()
    .withMessage("Địa chỉ không hợp lệ"),
  body("paymentMethod")
    .notEmpty()
    .withMessage("Phương thức thanh toán không được để trống")
    .isIn(["COD", "VNPAY"])
    .withMessage("Phương thức thanh toán không hợp lệ"),
  body("note").optional().isString().withMessage("Ghi chú phải là chuỗi"),
  body("couponCode")
    .optional()
    .isString()
    .withMessage("Mã giảm giá phải là chuỗi")
    .isLength({ min: 3, max: 20 })
    .withMessage("Mã giảm giá phải có độ dài từ 3-20 ký tự"),
];

/**
 * Validate tham số để lấy danh sách đơn hàng
 */
const validateGetOrders = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên và lớn hơn 0"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Giới hạn phải là số nguyên và từ 1-50"),
  query("status")
    .optional()
    .isIn([
      "pending",
      "confirmed",
      "assigned_to_shipper",
      "out_for_delivery",
      "delivered",
      "delivery_failed",
      "returning_to_warehouse",
      "cancelled",
      "returned",
      "refunded",
    ])
    .withMessage("Trạng thái không hợp lệ"),
  query("sort").optional().isString().withMessage("Sắp xếp phải là chuỗi"),
];

/**
 * Validate dữ liệu khi lấy chi tiết đơn hàng
 */
const validateGetOrder = [
  param("id")
    .notEmpty()
    .withMessage("ID đơn hàng không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID đơn hàng không hợp lệ"),
];

/**
 * Validate dữ liệu khi yêu cầu hủy đơn hàng
 */
const validateCancelOrder = [
  param("id")
    .notEmpty()
    .withMessage("ID đơn hàng không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID đơn hàng không hợp lệ"),
  body("reason")
    .notEmpty()
    .withMessage("Lý do hủy đơn hàng không được để trống")
    .isLength({ min: 3, max: 500 })
    .withMessage("Lý do hủy phải từ 3 đến 500 ký tự"),
];

/**
 * Validate dữ liệu khi xem thông tin vận chuyển
 */
const validateOrderTracking = [
  param("id")
    .notEmpty()
    .withMessage("ID đơn hàng không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID đơn hàng không hợp lệ"),
];

/**
 * Validate dữ liệu khi cập nhật trạng thái đơn hàng (admin)
 */
const validateUpdateOrderStatus = [
  param("id")
    .notEmpty()
    .withMessage("ID đơn hàng không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID đơn hàng không hợp lệ"),
  body("status")
    .notEmpty()
    .withMessage("Trạng thái không được để trống")
    .isIn([
      "confirmed",
      "shipping",
      "delivered",
      "refunded", // Admin có thể hoàn tiền
    ])
    .withMessage(
      "Trạng thái không hợp lệ (chỉ chấp nhận confirmed, shipping, delivered, refunded)"
    ),
  body("note")
    .optional()
    .isString()
    .withMessage("Ghi chú phải là chuỗi")
    .isLength({ max: 500 })
    .withMessage("Ghi chú không được vượt quá 500 ký tự"),
];

/**
 * Validate dữ liệu khi xử lý yêu cầu hủy đơn hàng
 */
const validateProcessCancelRequest = [
  param("id")
    .notEmpty()
    .withMessage("ID yêu cầu hủy không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID yêu cầu hủy không hợp lệ"),
  body("approved")
    .notEmpty()
    .withMessage("Quyết định duyệt không được để trống")
    .isBoolean()
    .withMessage("Quyết định duyệt phải là true hoặc false"),
  body("note")
    .optional()
    .isString()
    .withMessage("Ghi chú phải là chuỗi")
    .isLength({ max: 500 })
    .withMessage("Ghi chú không được vượt quá 500 ký tự"),
];

/**
 * Validate tham số để lấy danh sách yêu cầu hủy đơn hàng
 */
const validateGetCancelRequests = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên và lớn hơn 0"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Giới hạn phải là số nguyên và từ 1-50"),
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Trạng thái không hợp lệ"),
  query("sort").optional().isString().withMessage("Sắp xếp phải là chuỗi"),
];

/**
 * Validate tham số để lấy danh sách yêu cầu hủy đơn hàng của người dùng
 */
const validateGetUserCancelRequests = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên và lớn hơn 0"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Giới hạn phải là số nguyên và từ 1-50"),
  query("status")
    .optional()
    .isIn(["pending", "approved", "rejected"])
    .withMessage("Trạng thái không hợp lệ"),
  query("sort").optional().isString().withMessage("Sắp xếp phải là chuỗi"),
];

/**
 * Validate dữ liệu khi xử lý hoàn tiền (admin)
 */
const validateProcessRefund = [
  param("id")
    .notEmpty()
    .withMessage("ID đơn hàng không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID đơn hàng không hợp lệ"),
  body("amount")
    .notEmpty()
    .withMessage("Số tiền hoàn không được để trống")
    .isFloat({ min: 0.01 })
    .withMessage("Số tiền hoàn phải lớn hơn 0"),
  body("method")
    .notEmpty()
    .withMessage("Phương thức hoàn tiền không được để trống")
    .isIn(["cash", "bank_transfer"])
    .withMessage(
      "Phương thức không hợp lệ (chỉ chấp nhận: cash, bank_transfer)"
    ),
  body("bankInfo")
    .optional()
    .isObject()
    .withMessage("Thông tin ngân hàng phải là object"),
  body("bankInfo.bankName")
    .if(body("method").equals("bank_transfer"))
    .notEmpty()
    .withMessage("Tên ngân hàng không được để trống khi chuyển khoản"),
  body("bankInfo.accountNumber")
    .if(body("method").equals("bank_transfer"))
    .notEmpty()
    .withMessage("Số tài khoản không được để trống khi chuyển khoản"),
  body("bankInfo.accountName")
    .if(body("method").equals("bank_transfer"))
    .notEmpty()
    .withMessage("Tên chủ tài khoản không được để trống khi chuyển khoản"),
  body("notes")
    .optional()
    .isString()
    .withMessage("Ghi chú phải là chuỗi")
    .isLength({ max: 500 })
    .withMessage("Ghi chú không được vượt quá 500 ký tự"),
];

module.exports = {
  validateCreateOrder,
  validateGetOrders,
  validateGetOrder,
  validateCancelOrder,
  validateOrderTracking,
  validateUpdateOrderStatus,
  validateProcessCancelRequest,
  validateGetCancelRequests,
  validateGetUserCancelRequests,
  validateProcessRefund,
};
