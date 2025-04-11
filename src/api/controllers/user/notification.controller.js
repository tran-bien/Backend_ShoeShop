const asyncHandler = require("express-async-handler");
const notificationService = require("@services/notification.service");

const notificationController = {
  /**
   * @desc    Lấy danh sách thông báo của người dùng
   * @route   GET /api/notifications
   * @access  Private
   */
  getNotifications: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { page = 1, limit = 10, unreadOnly = false, type } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === "true",
      type,
    };

    const result = await notificationService.getNotifications(userId, options);

    return res.status(200).json({
      success: true,
      message: "Lấy danh sách thông báo thành công",
      data: {
        notifications: result.notifications,
        pagination: {
          total: result.total,
          page: options.page,
          limit: options.limit,
          pages: Math.ceil(result.total / options.limit),
        },
        unreadCount: result.unreadCount,
      },
    });
  }),

  /**
   * @desc    Lấy chi tiết một thông báo
   * @route   GET /api/notifications/:id
   * @access  Private
   */
  getNotificationById: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const notificationId = req.params.id;

    const notification = await notificationService.getNotificationById(
      notificationId,
      userId
    );

    return res.status(200).json({
      success: true,
      message: "Lấy chi tiết thông báo thành công",
      data: notification,
    });
  }),

  /**
   * @desc    Đánh dấu thông báo là đã đọc
   * @route   PATCH /api/notifications/:id/read
   * @access  Private
   */
  markAsRead: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const notificationId = req.params.id;

    await notificationService.markAsRead(notificationId, userId);

    return res.status(200).json({
      success: true,
      message: "Đánh dấu thông báo đã đọc thành công",
    });
  }),

  /**
   * @desc    Đánh dấu tất cả thông báo là đã đọc
   * @route   PATCH /api/notifications/read-all
   * @access  Private
   */
  markAllAsRead: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await notificationService.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: "Đánh dấu tất cả thông báo đã đọc thành công",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  }),

  /**
   * @desc    Xóa một thông báo
   * @route   DELETE /api/notifications/:id
   * @access  Private
   */
  deleteNotification: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const notificationId = req.params.id;

    await notificationService.deleteNotification(notificationId, userId);

    return res.status(200).json({
      success: true,
      message: "Xóa thông báo thành công",
    });
  }),

  /**
   * @desc    Xóa tất cả thông báo
   * @route   DELETE /api/notifications
   * @access  Private
   */
  deleteAllNotifications: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const result = await notificationService.deleteAllNotifications(userId);

    return res.status(200).json({
      success: true,
      message: "Xóa tất cả thông báo thành công",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  }),
};

module.exports = notificationController;
