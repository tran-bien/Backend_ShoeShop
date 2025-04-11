const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");
const { User, Notification } = require("@models");

/**
 * Tạo mới một thông báo
 * @param {Object} notificationData - Dữ liệu thông báo
 * @param {ObjectId} notificationData.user - ID của người dùng nhận thông báo
 * @param {String} notificationData.type - Loại thông báo (order, coupon, product, review, user, cancelRequest, other)
 * @param {String} notificationData.title - Tiêu đề thông báo
 * @param {String} notificationData.message - Nội dung thông báo
 * @param {ObjectId} [notificationData.relatedId] - ID của đối tượng liên quan
 * @param {String} [notificationData.onModel] - Model của đối tượng liên quan
 * @param {Boolean} [notificationData.isImportant=false] - Thông báo quan trọng hay không
 * @returns {Promise<Object>} Thông báo đã tạo
 */
const createNotification = async (notificationData) => {
  const notification = await Notification.create(notificationData);
  return notification;
};

/**
 * Lấy thông báo của người dùng
 * @param {string} userId ID người dùng
 * @param {Object} query Các tham số truy vấn
 * @returns {Promise<Object>} Danh sách thông báo và thông tin phân trang
 */
const getUserNotifications = async (userId, query = {}) => {
  const {
    page = 1,
    limit = 10,
    unreadOnly = false,
    type,
    sort = "-createdAt",
  } = query;

  // Xây dựng filter
  const filter = { user: userId };

  // Nếu chỉ lấy thông báo chưa đọc
  if (unreadOnly === "true") {
    filter.isRead = false;
  }

  // Lọc theo loại thông báo (nếu có)
  if (type) {
    filter.type = type;
  }

  // Chuyển đổi thành số nguyên
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    sort,
  };

  // Lấy tổng số thông báo của người dùng
  const total = await Notification.countDocuments(filter);

  // Lấy danh sách thông báo có phân trang
  const notifications = await Notification.find(filter)
    .sort(sort)
    .skip((options.page - 1) * options.limit)
    .limit(options.limit)
    .populate({
      path: "relatedId",
      select: "name images price status code -_id",
      options: { lean: true },
    });

  // Lấy số lượng thông báo chưa đọc
  const unreadCount = await Notification.countDocuments({
    user: userId,
    isRead: false,
  });

  return {
    notifications,
    pagination: {
      total,
      page: options.page,
      limit: options.limit,
      pages: Math.ceil(total / options.limit),
    },
    unreadCount,
    message: "Lấy danh sách thông báo thành công",
  };
};

/**
 * Lấy chi tiết một thông báo
 * @param {ObjectId} notificationId - ID của thông báo
 * @param {ObjectId} userId - ID của người dùng
 * @returns {Promise<Object>} Chi tiết thông báo
 */
const getNotificationById = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw new ApiError(404, "Không tìm thấy thông báo");
  }

  return notification;
};

/**
 * Đánh dấu thông báo đã đọc
 * @param {string} userId ID người dùng
 * @param {string} notificationId ID thông báo
 * @returns {Promise<Object>} Kết quả cập nhật
 */
const markNotificationAsRead = async (userId, notificationId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ApiError(400, "ID thông báo không hợp lệ");
  }

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { isRead: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, "Không tìm thấy thông báo");
  }

  return {
    notification,
    message: "Đánh dấu thông báo đã đọc thành công",
  };
};

/**
 * Đánh dấu tất cả thông báo đã đọc
 * @param {string} userId ID người dùng
 * @returns {Promise<Object>} Kết quả cập nhật
 */
const markAllNotificationsAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { user: userId, isRead: false },
    { isRead: true }
  );

  return {
    modifiedCount: result.modifiedCount,
    message: "Đánh dấu tất cả thông báo đã đọc thành công",
  };
};

/**
 * Xóa thông báo
 * @param {string} userId ID người dùng
 * @param {string} notificationId ID thông báo
 * @returns {Promise<Object>} Kết quả xóa
 */
const deleteNotification = async (userId, notificationId) => {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    throw new ApiError(400, "ID thông báo không hợp lệ");
  }

  const notification = await Notification.findOneAndDelete({
    _id: notificationId,
    user: userId,
  });

  if (!notification) {
    throw new ApiError(404, "Không tìm thấy thông báo");
  }

  return { message: "Xóa thông báo thành công" };
};

/**
 * Xóa tất cả thông báo đã đọc
 * @param {string} userId ID người dùng
 * @returns {Promise<Object>} Kết quả xóa
 */
const deleteAllReadNotifications = async (userId) => {
  const result = await Notification.deleteMany({
    user: userId,
    isRead: true,
  });

  return {
    deletedCount: result.deletedCount,
    message: "Xóa tất cả thông báo đã đọc thành công",
  };
};

/**
 * Gửi thông báo cho nhiều người dùng
 * @param {Array<string>} userIds Danh sách ID người dùng
 * @param {string} type Loại thông báo
 * @param {string} message Nội dung thông báo
 * @param {Object} metadata Dữ liệu bổ sung
 * @returns {Promise<Array<Object>>} Danh sách thông báo đã tạo
 */
const sendNotificationToMultipleUsers = async (
  userIds,
  type,
  message,
  metadata = {}
) => {
  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError(400, "Danh sách người dùng không hợp lệ");
  }

  const notifications = await Promise.all(
    userIds.map((userId) =>
      createNotification({
        user: userId,
        type,
        message,
        title: metadata.title || message,
        relatedId: metadata.relatedId,
        onModel: metadata.onModel,
        isImportant: metadata.isImportant || false,
      })
    )
  );

  return notifications;
};

/**
 * Gửi thông báo cho tất cả người dùng
 * @param {string} type Loại thông báo
 * @param {string} message Nội dung thông báo
 * @param {Object} metadata Dữ liệu bổ sung
 * @returns {Promise<Array<Object>>} Danh sách thông báo đã tạo
 */
const sendNotificationToAllUsers = async (type, message, metadata = {}) => {
  const users = await User.find({}, "_id").lean();
  const userIds = users.map((user) => user._id);

  const notifications = await Promise.all(
    userIds.map((userId) =>
      createNotification({
        user: userId,
        type,
        message,
        title: metadata.title || message,
        relatedId: metadata.relatedId,
        onModel: metadata.onModel,
        isImportant: metadata.isImportant || false,
      })
    )
  );

  return notifications;
};

const notificationService = {
  getUserNotifications,
  createNotification,
  getNotificationById,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllReadNotifications,
  sendNotificationToMultipleUsers,
  sendNotificationToAllUsers,
};

module.exports = notificationService;
