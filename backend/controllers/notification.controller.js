const asyncHandler = require("express-async-handler");
const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const NotificationService = require("../services/notification.service");

// @desc    Tạo thông báo cho một người dùng
// @route   POST /api/notifications
// @access  Admin
exports.createNotification = asyncHandler(async (req, res) => {
  const { userId, title, message, type, entityId } = req.body;

  const notification = await Notification.create({
    userId,
    title,
    message,
    type,
    entityId,
  });

  // Gửi thông báo realtime qua Socket.io
  const io = req.app.get("io");
  if (io) {
    const notificationService = new NotificationService(io);
    notificationService.sendToUser(userId, {
      _id: notification._id,
      title,
      message,
      type,
      entityId,
      createdAt: notification.createdAt,
    });
  }

  res.status(201).json({
    success: true,
    notification,
  });
});

// @desc    Tạo thông báo cho nhiều người dùng
// @route   POST /api/notifications/bulk
// @access  Admin
exports.createBulkNotifications = asyncHandler(async (req, res) => {
  const { userIds, title, message, type, entityId } = req.body;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    res.status(400);
    throw new Error("Vui lòng cung cấp danh sách ID người dùng");
  }

  const notifications = [];

  userIds.forEach((userId) => {
    notifications.push({
      userId,
      title,
      message,
      type,
      entityId,
    });
  });

  const result = await Notification.insertMany(notifications);

  // Gửi thông báo realtime qua Socket.io
  const io = req.app.get("io");
  if (io) {
    const notificationService = new NotificationService(io);
    notificationService.sendToUsers(userIds, {
      title,
      message,
      type,
      entityId,
      createdAt: new Date(),
    });
  }

  res.status(201).json({
    success: true,
    count: result.length,
    notifications: result,
  });
});

// @desc    Tạo thông báo cho tất cả người dùng
// @route   POST /api/notifications/global
// @access  Admin
exports.createGlobalNotification = asyncHandler(async (req, res) => {
  const { title, message, type, entityId } = req.body;

  // Lấy tất cả ID người dùng
  const users = await User.find({}, "_id");
  const userIds = users.map((user) => user._id);

  const notifications = [];

  userIds.forEach((userId) => {
    notifications.push({
      userId,
      title,
      message,
      type,
      entityId,
    });
  });

  const result = await Notification.insertMany(notifications);

  // Gửi thông báo realtime qua Socket.io
  const io = req.app.get("io");
  if (io) {
    const notificationService = new NotificationService(io);
    notificationService.sendToAll({
      title,
      message,
      type,
      entityId,
      isGlobal: true,
      createdAt: new Date(),
    });
  }

  res.status(201).json({
    success: true,
    count: result.length,
  });
});

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
