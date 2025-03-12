/**
 * Service xử lý thông báo realtime qua Socket.io
 */
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
    this.io.to(`user_${userId}`).emit("notification", notification);
    console.log(`Đã gửi thông báo đến người dùng ${userId}`);
  }

  /**
   * Gửi thông báo đến nhiều người dùng
   * @param {Array} userIds - Mảng chứa ID của các người dùng
   * @param {Object} notification - Đối tượng thông báo
   */
  sendToUsers(userIds, notification) {
    userIds.forEach((userId) => {
      this.io.to(`user_${userId}`).emit("notification", notification);
    });
    console.log(`Đã gửi thông báo đến ${userIds.length} người dùng`);
  }

  /**
   * Gửi thông báo đến tất cả người dùng
   * @param {Object} notification - Đối tượng thông báo
   */
  sendToAll(notification) {
    this.io.emit("notification", notification);
    console.log("Đã gửi thông báo đến tất cả người dùng");
  }

  /**
   * Gửi cập nhật trạng thái đơn hàng
   * @param {string} userId - ID của người dùng
   * @param {string} orderId - ID của đơn hàng
   * @param {string} status - Trạng thái mới của đơn hàng
   * @param {string} message - Nội dung thông báo
   */
  sendOrderStatusUpdate(userId, orderId, status, message) {
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

  /**
   * Gửi cập nhật trạng thái thanh toán
   * @param {string} userId - ID của người dùng
   * @param {string} orderId - ID của đơn hàng
   * @param {string} paymentStatus - Trạng thái thanh toán mới
   * @param {string} message - Nội dung thông báo
   */
  sendPaymentStatusUpdate(userId, orderId, paymentStatus, message) {
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

  /**
   * Gửi thông báo về sản phẩm mới
   * @param {Object} product - Thông tin sản phẩm mới
   */
  broadcastNewProduct(product) {
    this.io.emit("new_product", {
      productId: product._id,
      name: product.name,
      message: `Sản phẩm mới đã được thêm: ${product.name}`,
      timestamp: new Date(),
    });
    console.log(`Đã phát thông báo về sản phẩm mới: ${product.name}`);
  }
}

module.exports = NotificationService;
