const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const {
  createNotification,
  createBulkNotifications,
  createGlobalNotification,
} = require("@controllers/admin/notification.controller");

const router = express.Router();

// Route yêu cầu xác thực
router.use(protect);

// Route cho admin
router.post("/", admin, createNotification);
router.post("/bulk", admin, createBulkNotifications);
router.post("/global", admin, createGlobalNotification);

module.exports = router;
