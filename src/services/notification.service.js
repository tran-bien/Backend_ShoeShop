const Notification = require("../models/notification");
const { renderTemplate, generateIdempotencyKey } = require("@utils/notificationTemplates");
const ApiError = require("@utils/ApiError");

const notificationService = {
  /**
   * Tạo và gửi notification (idempotent)
   */
  send: async (userId, type, data, options = {}) => {
    const { channels, idempotencyKey } = options;

    // Generate idempotency key nếu không có
    const finalIdempotencyKey =
      idempotencyKey ||
      generateIdempotencyKey(
        type,
        userId,
        data.orderId || data.returnRequestId || data.reviewId
      );

    // Kiểm tra đã tồn tại chưa
    const existing = await Notification.findOne({
      idempotencyKey: finalIdempotencyKey,
    });

    if (existing) {
      console.log(
        `[NOTIFICATION IDEMPOTENCY] Notification đã tồn tại: ${finalIdempotencyKey}`
      );
      return {
        success: true,
        notification: existing,
        alreadyExists: true,
      };
    }

    // Render template
    const rendered = renderTemplate(type, data);

    // Tạo notification
    const notification = await Notification.create({
      user: userId,
      type,
      title: rendered.title,
      message: rendered.message,
      actionUrl: rendered.actionUrl,
      actionText: rendered.actionText,
      data,
      channels: channels || { inApp: true, email: false },
      idempotencyKey: finalIdempotencyKey,
      order: data.orderId,
      returnRequest: data.returnRequestId,
    });

    // Gửi email nếu cần
    if (channels?.email) {
      try {
        const emailService = require("@services/email.service");
        await emailService.sendNotificationEmail(userId, notification);

        notification.emailSent = true;
        notification.emailSentAt = new Date();
        await notification.save();
      } catch (error) {
        console.error("[NOTIFICATION] Lỗi gửi email:", error);
        notification.emailError = error.message;
        await notification.save();
      }
    }

    return {
      success: true,
      notification,
      alreadyExists: false,
    };
  },

  /**
   * Lấy notifications của user
   */
  getUserNotifications: async (userId, query = {}) => {
    const { page = 1, limit = 20, isRead, type } = query;

    const filter = { user: userId };

    if (isRead !== undefined) {
      filter.isRead = isRead === "true" || isRead === true;
    }

    if (type) {
      filter.type = type;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Notification.countDocuments(filter),
      Notification.countDocuments({ user: userId, isRead: false }),
    ]);

    return {
      success: true,
      notifications,
      unreadCount,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    };
  },

  /**
   * Đánh dấu đã đọc
   */
  markAsRead: async (userId, notificationId) => {
    const notification = await Notification.findOne({
      _id: notificationId,
      user: userId,
    });

    if (!notification) {
      throw new ApiError(404, "Không tìm thấy thông báo");
    }

    if (notification.isRead) {
      return {
        success: true,
        message: "Thông báo đã được đánh dấu đọc trước đó",
      };
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return {
      success: true,
      message: "Đã đánh dấu đọc",
    };
  },

  /**
   * Đánh dấu tất cả đã đọc
   */
  markAllAsRead: async (userId) => {
    const result = await Notification.updateMany(
      { user: userId, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return {
      success: true,
      markedCount: result.modifiedCount,
    };
  },

  /**
   * Xóa notification
   */
  deleteNotification: async (userId, notificationId) => {
    const result = await Notification.deleteOne({
      _id: notificationId,
      user: userId,
    });

    if (result.deletedCount === 0) {
      throw new ApiError(404, "Không tìm thấy thông báo");
    }

    return {
      success: true,
      message: "Đã xóa thông báo",
    };
  },
};

module.exports = notificationService;

