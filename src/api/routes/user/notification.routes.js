const express = require("express");
const router = express.Router();
const notificationController = require("@controllers/user/notification.controller");
const { protect } = require("@middlewares/auth.middleware");

router.use(protect);

/**
 * @route GET /api/users/notifications
 * @desc Lấy danh sách thông báo
 */
router.get("/", notificationController.getNotifications);

/**
 * @route PATCH /api/users/notifications/read-all
 * @desc Đánh dấu tất cả đã đọc
 */
router.patch("/read-all", notificationController.markAllAsRead);

/**
 * @route PATCH /api/users/notifications/:id/read
 * @desc Đánh dấu đã đọc
 */
router.patch("/:id/read", notificationController.markAsRead);

/**
 * @route DELETE /api/users/notifications/:id
 * @desc Xóa thông báo
 */
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;

