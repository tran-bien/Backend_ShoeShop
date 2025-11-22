const { query, param } = require("express-validator");
const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

const notificationValidator = {
  // Validate get notifications query
  validateNotificationsQuery: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Trang phải là số nguyên dương"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Giới hạn phải là số nguyên từ 1-100"),

    query("type")
      .optional()
      .isIn([
        "ORDER_CONFIRMED",
        "ORDER_SHIPPING",
        "ORDER_DELIVERED",
        "ORDER_CANCELLED",
        "RETURN_APPROVED",
        "RETURN_REJECTED",
        "RETURN_COMPLETED",
        "LOYALTY_TIER_UP",
        "POINTS_EARNED",
        "POINTS_EXPIRE_SOON",
      ])
      .withMessage("Loại thông báo không hợp lệ"),

    query("isRead")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái đọc phải là boolean"),
  ],

  // Validate notificationId param
  validateNotificationId: [
    param("id")
      .notEmpty()
      .withMessage("ID thông báo không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID thông báo không hợp lệ");
        }
        return true;
      }),
  ],
};

module.exports = notificationValidator;
