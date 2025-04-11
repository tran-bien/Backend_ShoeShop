const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

/**
 * Kiểm tra ID có phải là MongoDB ObjectId hợp lệ không
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "ID không hợp lệ");
  }
  return true;
};

/**
 * Validator cho ID thông báo
 */
const validateNotificationId = [
  param("id")
    .notEmpty()
    .withMessage("ID thông báo không được để trống")
    .custom(isValidObjectId)
    .withMessage("ID thông báo không hợp lệ"),
];

/**
 * Validator cho việc lấy danh sách thông báo
 */
const getNotificationsValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên dương"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Số lượng mỗi trang phải từ 1 đến 100"),
  query("unreadOnly")
    .optional()
    .isBoolean()
    .withMessage("Trạng thái đọc phải là boolean"),
  query("type")
    .optional()
    .isIn([
      "order",
      "coupon",
      "product",
      "review",
      "user",
      "cancelRequest",
      "other",
    ])
    .withMessage("Loại thông báo không hợp lệ"),
];

module.exports = {
  validateNotificationId,
  getNotificationsValidator,
};
