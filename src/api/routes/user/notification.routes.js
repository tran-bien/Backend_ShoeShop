const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require("@controllers/user/notification.controller");

const router = express.Router();

// Route yêu cầu xác thực
router.use(protect);

// Route cho người dùng
router.get("/", getUserNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/:notificationId/read", markAsRead);
router.put("/mark-all-read", markAllAsRead);
router.delete("/:notificationId", deleteNotification);

module.exports = router;
