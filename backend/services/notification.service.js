/**
 * Service xử lý thông báo realtime qua Socket.io và quản lý thông báo hệ thống
 */
const Notification = require("../models/notification.model");
const User = require("../models/user.model");

class NotificationService {
  constructor(io) {
    this.io = io;
  }

  /**
   * Gửi thông báo đến một người dùng cụ thể
   * @param {string} userId - ID của người dùng
   * @param {Object} notification - Đối tượng thông báo
   */
  sendToUser(userId, notification) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit("notification", notification);
      console.log(`Đã gửi thông báo đến người dùng ${userId}`);
    }
  }

  /**
   * Gửi thông báo đến nhiều người dùng
   * @param {Array} userIds - Mảng chứa ID của các người dùng
   * @param {Object} notification - Đối tượng thông báo
   */
  sendToUsers(userIds, notification) {
    if (this.io) {
      userIds.forEach((userId) => {
        this.io.to(`user_${userId}`).emit("notification", notification);
      });
      console.log(`Đã gửi thông báo đến ${userIds.length} người dùng`);
    }
  }

  /**
   * Gửi thông báo đến tất cả người dùng
   * @param {Object} notification - Đối tượng thông báo
   */
  sendToAll(notification) {
    if (this.io) {
      this.io.emit("notification", notification);
      console.log("Đã gửi thông báo đến tất cả người dùng");
    }
  }

  /**
   * Gửi cập nhật trạng thái đơn hàng
   * @param {string} userId - ID của người dùng
   * @param {string} orderId - ID của đơn hàng
   * @param {string} status - Trạng thái mới của đơn hàng
   * @param {string} message - Nội dung thông báo
   */
  sendOrderStatusUpdate(userId, orderId, status, message) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit("order_update", {
        orderId,
        status,
        message,
        timestamp: new Date(),
      });
      console.log(
        `Đã gửi cập nhật trạng thái đơn hàng ${orderId} đến người dùng ${userId}`
      );
    }
  }

  /**
   * Gửi cập nhật trạng thái thanh toán
   * @param {string} userId - ID của người dùng
   * @param {string} orderId - ID của đơn hàng
   * @param {string} paymentStatus - Trạng thái thanh toán mới
   * @param {string} message - Nội dung thông báo
   */
  sendPaymentStatusUpdate(userId, orderId, paymentStatus, message) {
    if (this.io) {
      this.io.to(`user_${userId}`).emit("payment_update", {
        orderId,
        paymentStatus,
        message,
        timestamp: new Date(),
      });
      console.log(
        `Đã gửi cập nhật trạng thái thanh toán ${paymentStatus} đến người dùng ${userId}`
      );
    }
  }

  /**
   * Gửi thông báo về sản phẩm mới
   * @param {Object} product - Thông tin sản phẩm mới
   */
  broadcastNewProduct(product) {
    if (this.io) {
      this.io.emit("new_product", {
        productId: product._id,
        name: product.name,
        message: `Sản phẩm mới đã được thêm: ${product.name}`,
        timestamp: new Date(),
      });
      console.log(`Đã phát thông báo về sản phẩm mới: ${product.name}`);
    }
  }

  /**
   * Tạo thông báo cho một người dùng
   * @param {String} userId - ID người dùng
   * @param {String} title - Tiêu đề thông báo
   * @param {String} message - Nội dung thông báo
   * @param {String} type - Loại thông báo
   * @param {String} entityId - ID của đối tượng liên quan
   * @param {Object} io - Socket.io instance (optional)
   * @returns {Object} - Thông báo đã tạo
   */
  async createNotification(userId, title, message, type, entityId, io) {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
      entityId,
    });

    // Gửi thông báo realtime nếu có socket
    if (io) {
      this.io = io;
      this.sendToUser(userId, {
        _id: notification._id,
        title,
        message,
        type,
        entityId,
        createdAt: notification.createdAt,
      });
    }

    return notification;
  }

  /**
   * Tạo thông báo cho nhiều người dùng
   * @param {Array} userIds - Danh sách ID người dùng
   * @param {String} title - Tiêu đề thông báo
   * @param {String} message - Nội dung thông báo
   * @param {String} type - Loại thông báo
   * @param {String} entityId - ID của đối tượng liên quan
   * @param {Object} io - Socket.io instance (optional)
   * @returns {Array} - Danh sách thông báo đã tạo
   */
  async createBulkNotifications(userIds, title, message, type, entityId, io) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
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

    // Gửi thông báo realtime nếu có socket
    if (io) {
      this.io = io;
      this.sendToUsers(userIds, {
        title,
        message,
        type,
        entityId,
        createdAt: new Date(),
      });
    }

    return result;
  }

  /**
   * Tạo thông báo cho tất cả người dùng
   * @param {String} title - Tiêu đề thông báo
   * @param {String} message - Nội dung thông báo
   * @param {String} type - Loại thông báo
   * @param {String} entityId - ID của đối tượng liên quan
   * @param {Object} io - Socket.io instance (optional)
   * @returns {Object} - Kết quả tạo thông báo
   */
  async createGlobalNotification(title, message, type, entityId, io) {
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

    // Gửi thông báo realtime nếu có socket
    if (io) {
      this.io = io;
      this.sendToAll({
        title,
        message,
        type,
        entityId,
        isGlobal: true,
        createdAt: new Date(),
      });
    }

    return { count: result.length };
  }

  /**
   * Lấy danh sách thông báo của người dùng
   * @param {String} userId - ID người dùng
   * @param {Object} queryParams - Tham số truy vấn (page, limit)
   * @returns {Object} - Danh sách thông báo và thông tin phân trang
   */
  async getUserNotifications(userId, queryParams = {}) {
    const { page = 1, limit = 10 } = queryParams;
    const skip = (Number(page) - 1) * Number(limit);

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const count = await Notification.countDocuments({ userId });

    return {
      count,
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
      notifications,
    };
  }

  /**
   * Đánh dấu thông báo đã đọc
   * @param {String} notificationId - ID thông báo
   * @param {String} userId - ID người dùng
   * @returns {Object} - Thông báo đã cập nhật
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        userId,
      },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error("Không tìm thấy thông báo");
    }

    return notification;
  }

  /**
   * Đánh dấu tất cả thông báo đã đọc
   * @param {String} userId - ID người dùng
   * @returns {Object} - Kết quả cập nhật
   */
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    return {
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
      modifiedCount: result.nModified || result.modifiedCount || 0,
    };
  }

  /**
   * Xóa thông báo
   * @param {String} notificationId - ID thông báo
   * @param {String} userId - ID người dùng
   * @returns {Object} - Kết quả xóa
   */
  async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      throw new Error("Không tìm thấy thông báo");
    }

    return { message: "Đã xóa thông báo" };
  }

  /**
   * Đếm số thông báo chưa đọc
   * @param {String} userId - ID người dùng
   * @returns {Number} - Số thông báo chưa đọc
   */
  async getUnreadCount(userId) {
    const count = await Notification.countDocuments({
      userId,
      isRead: false,
    });

    return count;
  }
}

// Tạo một instance notificationService không cần socket.io
// để sử dụng các phương thức không yêu cầu socket
const notificationService = new NotificationService();

module.exports = NotificationService;
module.exports.notificationService = notificationService;
