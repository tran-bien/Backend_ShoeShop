const express = require("express");
const router = express.Router();
const notificationController = require("@controllers/user/notification.controller");
const { protect } = require("@middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const notificationValidator = require("@validators/notification.validator");

/**
 * @description Áp dụng middleware xác thực cho tất cả các routes
 * @access      Người dùng đã đăng nhập
 */
router.use(protect);

/**
 * @route   GET /api/notifications
 * @desc    Lấy danh sách thông báo
 * @access  Private
 */
router.get(
  "/",
  validate(notificationValidator.getNotificationsValidator),
  notificationController.getNotifications
);

/**
 * @route   GET /api/notifications/:id
 * @desc    Lấy chi tiết thông báo
 * @access  Private
 */
router.get(
  "/:id",
  validate(notificationValidator.validateNotificationId),
  notificationController.getNotificationById
);

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Đánh dấu thông báo đã đọc
 * @access  Private
 */
router.patch(
  "/:id/read",
  validate(notificationValidator.validateNotificationId),
  notificationController.markAsRead
);

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Đánh dấu tất cả thông báo đã đọc
 * @access  Private
 */
router.patch("/read-all", notificationController.markAllAsRead);

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Xóa một thông báo
 * @access  Private
 */
router.delete(
  "/:id",
  validate(notificationValidator.validateNotificationId),
  notificationController.deleteNotification
);

/**
 * @route   DELETE /api/notifications
 * @desc    Xóa tất cả thông báo
 * @access  Private
 */
router.delete("/", notificationController.deleteAllNotifications);

module.exports = router;
