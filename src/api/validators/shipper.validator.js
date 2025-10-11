const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Validator cho gán đơn hàng
 */
exports.validateAssignOrder = [
  param("orderId")
    .notEmpty()
    .withMessage("Order ID không được để trống")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Order ID không hợp lệ");
      }
      return true;
    }),

  body("shipperId")
    .notEmpty()
    .withMessage("Shipper ID không được để trống")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Shipper ID không hợp lệ");
      }
      return true;
    }),
];

/**
 * Validator cho cập nhật trạng thái giao hàng
 */
exports.validateUpdateDeliveryStatus = [
  param("orderId")
    .notEmpty()
    .withMessage("Order ID không được để trống")
    .isMongoId()
    .withMessage("Order ID không hợp lệ"),

  body("status")
    .notEmpty()
    .withMessage("Trạng thái không được để trống")
    .isIn(["out_for_delivery", "delivery_failed", "delivered"])
    .withMessage(
      "Trạng thái phải là: out_for_delivery, delivery_failed, hoặc delivered"
    ),

  body("note").optional().isString(),

  body("images").optional().isArray().withMessage("Images phải là array"),

  body("images.*")
    .optional()
    .isString()
    .withMessage("Mỗi image phải là string"),

  body("location").optional().isObject().withMessage("Location phải là object"),

  body("location.latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Vĩ độ phải từ -90 đến 90"),

  body("location.longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Kinh độ phải từ -180 đến 180"),

  body("location.address").optional().isString(),
];

/**
 * Validator cho cập nhật vị trí
 */
exports.validateUpdateLocation = [
  body("latitude")
    .notEmpty()
    .withMessage("Vĩ độ không được để trống")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Vĩ độ phải từ -90 đến 90"),

  body("longitude")
    .notEmpty()
    .withMessage("Kinh độ không được để trống")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Kinh độ phải từ -180 đến 180"),
];

/**
 * Validator cho cập nhật trạng thái sẵn sàng
 */
exports.validateUpdateAvailability = [
  body("isAvailable")
    .notEmpty()
    .withMessage("Trạng thái sẵn sàng không được để trống")
    .isBoolean()
    .withMessage("Trạng thái sẵn sàng phải là boolean"),
];

/**
 * Validator cho lấy danh sách shipper
 */
exports.validateGetShippers = [
  query("available")
    .optional()
    .isIn(["true", "false"])
    .withMessage("available phải là true hoặc false"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số trang phải là số nguyên dương"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Số lượng mỗi trang phải từ 1-100"),
];

/**
 * Validator cho lấy đơn hàng của shipper
 */
exports.validateGetShipperOrders = [
  query("status")
    .optional()
    .isIn([
      "assigned_to_shipper",
      "out_for_delivery",
      "delivery_failed",
      "delivered",
    ])
    .withMessage("Trạng thái không hợp lệ"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Số trang phải là số nguyên dương"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Số lượng mỗi trang phải từ 1-100"),
];

/**
 * Validator cho shipper ID
 */
exports.validateShipperId = [
  param("shipperId")
    .notEmpty()
    .withMessage("Shipper ID không được để trống")
    .isMongoId()
    .withMessage("Shipper ID không hợp lệ"),
];
