const Order = require("../models/order.model");
const Product = require("../models/product.model");
const Coupon = require("../models/coupon.model");
const mongoose = require("mongoose");
const Notification = require("../models/notification.model");
const CancelRequestModel = require("../models/cancel.request.model");

const orderService = {
  /**
   * Tính phí vận chuyển dựa trên giá trị đơn hàng
   * @param {Number} orderValue - Tổng giá trị đơn hàng (chưa tính phí vận chuyển)
   * @returns {Number} - Phí vận chuyển
   */
  calculateShippingFee: (orderValue) => {
    // Nếu đơn hàng trên 500k, miễn phí vận chuyển
    if (orderValue >= 500000) {
      return 0;
    }

    // Nếu đơn hàng trên 300k, giảm phí vận chuyển còn 15k
    if (orderValue >= 300000) {
      return 15000;
    }

    // Đơn hàng dưới 300k, phí vận chuyển là 30k
    return 30000;
  },

  /**
   * Kiểm tra và tính toán mã giảm giá
   * @param {String} couponCode - Mã giảm giá
   * @param {Number} orderValue - Tổng giá trị đơn hàng (chưa tính phí vận chuyển)
   * @param {String} userId - ID người dùng
   * @returns {Object} - Kết quả kiểm tra mã giảm giá
   */
  validateCoupon: async (couponCode, orderValue, userId) => {
    // Tìm mã giảm giá
    const coupon = await Coupon.findOne({
      code: { $regex: new RegExp(`^${couponCode}$`, "i") },
      isActive: true,
      expiryDate: { $gt: new Date() },
    });

    // Kiểm tra mã giảm giá có tồn tại không
    if (!coupon) {
      return {
        valid: false,
        message: "Mã giảm giá không tồn tại hoặc đã hết hạn",
      };
    }

    // Kiểm tra xem mã giảm giá đã được sử dụng bởi người dùng này chưa
    if (coupon.usedBy.includes(userId)) {
      return {
        valid: false,
        message: "Bạn đã sử dụng mã giảm giá này rồi",
      };
    }

    // Kiểm tra giới hạn số lần sử dụng
    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return {
        valid: false,
        message: "Mã giảm giá đã hết lượt sử dụng",
      };
    }

    // Kiểm tra điều kiện áp dụng (giá trị tối thiểu)
    if (coupon.minOrderValue > 0 && orderValue < coupon.minOrderValue) {
      return {
        valid: false,
        message: `Mã giảm giá chỉ áp dụng cho đơn hàng từ ${coupon.minOrderValue.toLocaleString()} đ`,
      };
    }

    // Tính giá trị giảm giá
    let discountAmount = 0;
    if (coupon.discountType === "percentage") {
      // Giảm theo phần trăm
      discountAmount = (orderValue * coupon.discountValue) / 100;

      // Áp dụng giới hạn giảm nếu có
      if (
        coupon.maxDiscountAmount > 0 &&
        discountAmount > coupon.maxDiscountAmount
      ) {
        discountAmount = coupon.maxDiscountAmount;
      }
    } else {
      // Giảm cố định
      discountAmount = coupon.discountValue;

      // Đảm bảo số tiền giảm không vượt quá giá trị đơn hàng
      if (discountAmount > orderValue) {
        discountAmount = orderValue;
      }
    }

    return {
      valid: true,
      discount: discountAmount,
      coupon,
    };
  },

  /**
   * Gửi yêu cầu hủy đơn hàng
   * @param {String} orderId - ID đơn hàng
   * @param {String} userId - ID người dùng
   * @param {String} reason - Lý do hủy đơn
   * @returns {Object} - Yêu cầu hủy đơn hàng
   */
  cancelOrder: async (orderId, userId, reason) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Tìm đơn hàng
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        throw new Error("Không tìm thấy đơn hàng");
      }

      // Kiểm tra quyền sở hữu đơn hàng
      if (order.userId.toString() !== userId.toString()) {
        throw new Error("Bạn không có quyền hủy đơn hàng này");
      }

      // Kiểm tra trạng thái đơn hàng
      if (order.status !== "pending" && order.status !== "confirmed") {
        throw new Error(
          "Chỉ có thể hủy đơn hàng ở trạng thái chờ xác nhận hoặc đã xác nhận"
        );
      }

      // Kiểm tra đã có yêu cầu hủy đơn nào chưa
      const existingRequest = await CancelRequestModel.findOne({
        orderId: order._id,
        status: "pending",
      }).session(session);

      if (existingRequest) {
        throw new Error("Đơn hàng này đã có yêu cầu hủy đang chờ xử lý");
      }

      // Tạo yêu cầu hủy đơn
      const cancelRequest = await CancelRequestModel.create(
        [
          {
            orderId: order._id,
            userId: userId,
            reason: reason,
            status: "pending",
          },
        ],
        { session }
      );

      // Cập nhật trạng thái đơn hàng nếu cần
      order.cancelRequest = cancelRequest[0]._id;
      await order.save({ session });

      // Tạo thông báo cho admin
      await Notification.create(
        [
          {
            userId: null, // Null means for admin
            title: "Yêu cầu hủy đơn hàng mới",
            message: `Khách hàng đã gửi yêu cầu hủy đơn hàng #${order.orderCode}.`,
            type: "order_cancel",
            entityId: order._id,
          },
        ],
        { session }
      );

      // Tạo thông báo cho khách hàng
      await Notification.create(
        [
          {
            userId: userId,
            title: "Đã gửi yêu cầu hủy đơn hàng",
            message: `Yêu cầu hủy đơn hàng #${order.orderCode} của bạn đã được gửi đi. Chúng tôi sẽ xem xét và phản hồi sớm.`,
            type: "order",
            entityId: order._id,
          },
        ],
        { session }
      );

      // Hoàn tất transaction
      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        message: "Yêu cầu hủy đơn hàng đã được gửi thành công",
        data: cancelRequest[0],
      };
    } catch (error) {
      // Hủy bỏ transaction nếu có lỗi
      await session.abortTransaction();
      session.endSession();

      throw error;
    }
  },

  /**
   * Cập nhật trạng thái đơn hàng
   * @param {String} orderId - ID đơn hàng
   * @param {String} status - Trạng thái mới
   * @param {Object} updateData - Dữ liệu cập nhật bổ sung
   * @param {String} updatedBy - ID người cập nhật
   * @returns {Object} - Đơn hàng đã cập nhật
   */
  updateOrderStatus: async (orderId, status, updateData = {}, updatedBy) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Tìm đơn hàng
      const order = await Order.findById(orderId)
        .populate({
          path: "orderItems.product",
          select: "name thumbnail",
        })
        .session(session);

      if (!order) {
        throw new Error("Không tìm thấy đơn hàng");
      }

      // Danh sách các trạng thái hợp lệ
      const validStatuses = [
        "pending",
        "confirmed",
        "shipping",
        "delivered",
        "cancelled",
        "returned",
      ];

      // Kiểm tra trạng thái hợp lệ
      if (!validStatuses.includes(status)) {
        throw new Error("Trạng thái đơn hàng không hợp lệ");
      }

      // Lưu trạng thái hiện tại để so sánh
      const currentStatus = order.status;

      // Kiểm tra luồng trạng thái hợp lệ
      if (
        (currentStatus === "delivered" && status !== "returned") ||
        (currentStatus === "cancelled" && status !== "pending") ||
        currentStatus === "returned"
      ) {
        throw new Error(
          `Không thể chuyển đơn hàng từ trạng thái ${currentStatus} sang ${status}`
        );
      }

      // Nếu đơn hàng đã giao, không thể chuyển về trạng thái trước đó
      if (
        currentStatus === "delivered" &&
        ["pending", "confirmed", "shipping"].includes(status)
      ) {
        throw new Error(
          "Không thể chuyển đơn hàng đã giao về trạng thái trước đó"
        );
      }

      // Nếu đơn hàng đang vận chuyển, không thể chuyển về trạng thái chờ xác nhận
      if (currentStatus === "shipping" && status === "pending") {
        throw new Error(
          "Không thể chuyển đơn hàng đang vận chuyển về trạng thái chờ xác nhận"
        );
      }

      // Xử lý các loại cập nhật cụ thể
      if (status === "shipping" && currentStatus !== "shipping") {
        // Cập nhật thông tin vận chuyển
        if (updateData.trackingInfo) {
          order.trackingInfo = {
            ...order.trackingInfo,
            ...updateData.trackingInfo,
            updatedAt: new Date(),
          };
        }
      } else if (status === "cancelled") {
        // Cập nhật lý do hủy đơn
        if (updateData.cancelReason) {
          order.cancelReason = updateData.cancelReason;
        }

        // Khôi phục sản phẩm vào kho
        await Promise.all(
          order.orderItems.map(async (item) => {
            if (item.color && item.size && item.product) {
              // Tìm và cập nhật số lượng trong kho
              await Product.updateOne(
                {
                  _id: item.product._id,
                  "variants.color": item.color,
                  "variants.sizes.size": item.size,
                },
                {
                  $inc: {
                    "variants.$.sizes.$[sizeElem].quantity": item.quantity,
                  },
                },
                {
                  arrayFilters: [{ "sizeElem.size": item.size }],
                  session,
                }
              );
            }
          })
        );

        // Cập nhật trạng thái yêu cầu hủy đơn nếu có
        if (order.cancelRequest) {
          await CancelRequestModel.findByIdAndUpdate(
            order.cancelRequest,
            {
              status: "approved",
              updatedAt: new Date(),
              updatedBy,
            },
            { session }
          );
        }
      } else if (status === "delivered") {
        // Đơn hàng đã được giao thành công
        order.deliveredAt = new Date();
      }

      // Cập nhật trạng thái đơn hàng
      order.status = status;

      // Ghi lại lịch sử chuyển trạng thái
      order.statusHistory.push({
        status,
        updatedBy,
        timestamp: new Date(),
        note: updateData.note || "",
      });

      // Lưu đơn hàng
      await order.save({ session });

      // Tạo thông báo dựa trên trạng thái mới
      let notificationTitle = "";
      let notificationMessage = "";

      if (status === "confirmed") {
        notificationTitle = "Đơn hàng đã được xác nhận";
        notificationMessage = `Đơn hàng #${order.orderCode} của bạn đã được xác nhận và đang được chuẩn bị.`;
      } else if (status === "shipping") {
        notificationTitle = "Đơn hàng đang được giao";
        notificationMessage = `Đơn hàng #${order.orderCode} của bạn đang được giao đến địa chỉ của bạn.`;
        if (order.trackingInfo && order.trackingInfo.trackingNumber) {
          notificationMessage += ` Mã vận đơn: ${order.trackingInfo.trackingNumber}`;
        }
      } else if (status === "delivered") {
        notificationTitle = "Đơn hàng đã giao thành công";
        notificationMessage = `Đơn hàng #${order.orderCode} đã được giao thành công. Cảm ơn bạn đã mua hàng!`;
      } else if (status === "cancelled") {
        notificationTitle = "Đơn hàng đã bị hủy";
        notificationMessage = `Đơn hàng #${order.orderCode} đã bị hủy. Lý do: ${
          order.cancelReason || "Không xác định"
        }`;
      }

      // Lưu thông báo vào cơ sở dữ liệu
      if (notificationTitle && notificationMessage) {
        await Notification.create(
          [
            {
              userId: order.userId,
              title: notificationTitle,
              message: notificationMessage,
              type: "order",
              entityId: orderId,
            },
          ],
          { session }
        );
      }

      // Hoàn tất transaction
      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        message: "Cập nhật trạng thái đơn hàng thành công",
        order,
      };
    } catch (error) {
      // Hủy bỏ transaction nếu có lỗi
      await session.abortTransaction();
      session.endSession();

      throw error;
    }
  },

  /**
   * Cập nhật trạng thái thanh toán đơn hàng
   * @param {String} orderId - ID đơn hàng
   * @param {String} paymentStatus - Trạng thái thanh toán mới
   * @param {Object} updateData - Dữ liệu cập nhật bổ sung
   * @param {String} updatedBy - ID người cập nhật
   * @returns {Object} - Đơn hàng đã cập nhật
   */
  updatePaymentStatus: async (
    orderId,
    paymentStatus,
    updateData = {},
    updatedBy
  ) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Tìm đơn hàng
      const order = await Order.findById(orderId).session(session);

      if (!order) {
        throw new Error("Không tìm thấy đơn hàng");
      }

      // Danh sách các trạng thái hợp lệ
      const validPaymentStatuses = ["pending", "paid", "failed"];

      // Kiểm tra trạng thái hợp lệ
      if (!validPaymentStatuses.includes(paymentStatus)) {
        throw new Error("Trạng thái thanh toán không hợp lệ");
      }

      // Lưu trạng thái hiện tại để so sánh
      const oldPaymentStatus = order.paymentStatus;

      // Không thay đổi nếu trạng thái giống nhau
      if (oldPaymentStatus === paymentStatus) {
        throw new Error("Trạng thái thanh toán không thay đổi");
      }

      // Cập nhật trạng thái thanh toán
      order.paymentStatus = paymentStatus;

      // Ghi lại lịch sử thanh toán
      if (!order.paymentHistory) {
        order.paymentHistory = [];
      }

      order.paymentHistory.push({
        status: paymentStatus,
        updatedBy,
        timestamp: new Date(),
        note: updateData.note || "",
      });

      // Cập nhật thông tin thanh toán nếu có
      if (updateData.paymentDetails) {
        order.paymentDetails = {
          ...order.paymentDetails,
          ...updateData.paymentDetails,
        };
      }

      // Loại thông báo
      const notificationType = "payment";
      let notificationTitle = "";
      let notificationMessage = "";

      // Xử lý các trường hợp đặc biệt
      if (paymentStatus === "paid" && oldPaymentStatus !== "paid") {
        // Thanh toán thành công - Cập nhật trạng thái đơn hàng nếu đang pending
        if (order.status === "pending") {
          order.status = "confirmed";
          order.statusHistory.push({
            status: "confirmed",
            updatedBy,
            timestamp: new Date(),
            note: "Tự động cập nhật sau khi thanh toán thành công",
          });
        }

        notificationTitle = "Thanh toán thành công";
        notificationMessage = `Đơn hàng #${order.orderCode} của bạn đã được thanh toán thành công.`;
      } else if (paymentStatus === "failed" && oldPaymentStatus !== "failed") {
        // Thanh toán thất bại - Thông báo cho người dùng
        notificationTitle = "Thanh toán thất bại";
        notificationMessage = `Thanh toán cho đơn hàng #${order.orderCode} của bạn không thành công. Vui lòng thử lại hoặc chọn phương thức thanh toán khác.`;
      }

      // Lưu đơn hàng với thay đổi
      await order.save({ session });

      // Tạo thông báo trong database nếu có
      if (notificationTitle && notificationMessage && order.userId) {
        await Notification.create(
          [
            {
              userId: order.userId,
              title: notificationTitle,
              message: notificationMessage,
              type: notificationType,
              entityId: orderId,
            },
          ],
          { session }
        );
      }

      // Hoàn tất transaction
      await session.commitTransaction();
      session.endSession();

      // Trả về đơn hàng đã cập nhật
      return await Order.findById(orderId);
    } catch (error) {
      // Hủy bỏ transaction nếu có lỗi
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },
};

module.exports = orderService;
