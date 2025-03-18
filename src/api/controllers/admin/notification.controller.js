const asyncHandler = require("express-async-handler");
const Notification = require("@models/notification.model");
const User = require("@models/user.model");
const NotificationService = require("@services/notification.service");

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
