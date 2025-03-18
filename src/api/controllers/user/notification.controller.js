const asyncHandler = require("express-async-handler");
const Notification = require("@models/notification.model");
const User = require("@models/user.model");
const NotificationService = require("@services/notification.service");

// Lấy danh sách thông báo của người dùng
exports.getUserNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const notifications = await Notification.find({ userId: req.user._id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit));

  const count = await Notification.countDocuments({ userId: req.user._id });

  res.json({
    success: true,
    count,
    totalPages: Math.ceil(count / Number(limit)),
    currentPage: Number(page),
    notifications,
  });
});

// Đánh dấu thông báo đã đọc
exports.markAsRead = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      userId: req.user._id,
    },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thông báo",
    });
  }

  res.json({
    success: true,
    notification,
  });
});

// Đánh dấu tất cả thông báo đã đọc
exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { userId: req.user._id, isRead: false },
    { isRead: true }
  );

  res.json({
    success: true,
    message: "Đã đánh dấu tất cả thông báo là đã đọc",
  });
});

// Xóa thông báo
exports.deleteNotification = asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    userId: req.user._id,
  });

  if (!notification) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thông báo",
    });
  }

  res.json({
    success: true,
    message: "Đã xóa thông báo",
  });
});

// Đếm số thông báo chưa đọc
exports.getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({
    userId: req.user._id,
    isRead: false,
  });

  res.json({
    success: true,
    unreadCount: count,
  });
});
