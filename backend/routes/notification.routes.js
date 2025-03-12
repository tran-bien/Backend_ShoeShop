const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  createNotification,
  createBulkNotifications,
  createGlobalNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getUnreadCount,
} = require("../controllers/notification.controller");

const router = express.Router();

// Route yêu cầu xác thực
router.use(protect);

// Route cho người dùng
router.get("/", getUserNotifications);
router.get("/unread-count", getUnreadCount);
router.put("/:notificationId/read", markAsRead);
router.put("/mark-all-read", markAllAsRead);
router.delete("/:notificationId", deleteNotification);

// Route cho admin
router.post("/", admin, createNotification);
router.post("/bulk", admin, createBulkNotifications);
router.post("/global", admin, createGlobalNotification);

module.exports = router;
