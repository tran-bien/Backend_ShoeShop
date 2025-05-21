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
    .isIn(["pending", "confirmed", "shipping", "delivered", "cancelled"])
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
  .isIn(["confirmed", "shipping", "delivered"])  // Không cho phép trực tiếp chuyển sang cancelled
  .withMessage("Trạng thái không hợp lệ (chỉ chấp nhận confirmed, shipping, delivered)"),
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
  body("status")
    .notEmpty()
    .withMessage("Trạng thái không được để trống")
    .isIn(["approved", "rejected"])
    .withMessage("Trạng thái không hợp lệ"),
  body("adminResponse")
    .optional()
    .isString()
    .withMessage("Phản hồi phải là chuỗi")
    .isLength({ max: 500 })
    .withMessage("Phản hồi không được vượt quá 500 ký tự"),
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

module.exports = {
  validateCreateOrder,
  validateGetOrders,
  validateGetOrder,
  validateCancelOrder,
  validateOrderTracking,
  validateUpdateOrderStatus,
  validateProcessCancelRequest,
  validateGetCancelRequests,
  validateGetUserCancelRequests
};