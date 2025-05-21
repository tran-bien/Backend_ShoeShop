const mongoose = require("mongoose");
const { createNotification } = require("@services/notification.service");

/**
 * Cập nhật số lượng tồn kho từ đơn hàng
 * @param {Object} orderItem Mặt hàng trong đơn hàng
 * @param {String} action 'decrement' hoặc 'increment'
 */
const updateInventory = async (orderItem, action) => {
  try {
    const Variant = mongoose.model("Variant");

    if (!orderItem.variant || !orderItem.size || !orderItem.quantity) return;

    // Tìm biến thể
    const variant = await Variant.findById(orderItem.variant);
    if (!variant) return;

    // Tìm size trong biến thể
    const sizeIndex = variant.sizes.findIndex(
      (s) => s.size.toString() === orderItem.size.toString()
    );

    if (sizeIndex === -1) return;

    // Cập nhật số lượng
    if (action === "decrement") {
      variant.sizes[sizeIndex].quantity = Math.max(
        0,
        variant.sizes[sizeIndex].quantity - orderItem.quantity
      );
    } else {
      variant.sizes[sizeIndex].quantity += orderItem.quantity;
    }

    // Cập nhật trạng thái available
    variant.sizes[sizeIndex].isSizeAvailable =
      variant.sizes[sizeIndex].quantity > 0;

    // Lưu biến thể (middleware sau save sẽ cập nhật stock sản phẩm)
    await variant.save();

    console.log(
      `[order/middlewares] Đã ${action === "decrement" ? "giảm" : "tăng"} ${
        orderItem.quantity
      } sản phẩm cho variant ${variant._id}`
    );
  } catch (error) {
    console.error(`[order/middlewares] Lỗi cập nhật tồn kho: ${error.message}`);
  }
};

/**
 * Tạo mã đơn hàng không trùng
 * @returns {String} Mã đơn hàng mới
 */
const generateOrderCode = async () => {
  try {
    // Lấy đơn hàng mới nhất
    const latestOrder = await mongoose.model("Order").findOne().sort({ createdAt: -1 });
    
    if (!latestOrder || !latestOrder.code) {
      // Nếu không có đơn hàng hoặc không có mã, bắt đầu từ 1
      return "ORD000001";
    }
    
    // Lấy số từ mã đơn hàng hiện tại và tăng lên 1
    const currentCode = latestOrder.code;
    const numericPart = currentCode.replace("ORD", "");
    const nextNumericValue = parseInt(numericPart, 10) + 1;
    
    // Đảm bảo có đủ số 0 phía trước
    return `ORD${String(nextNumericValue).padStart(6, "0")}`;
  } catch (error) {
    console.error("Lỗi khi tạo mã đơn hàng:", error);
    // Tạo mã ngẫu nhiên để tránh lỗi
    const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, "0");
    return `ORD${randomPart}`;
  }
};

/**
 * Gửi thông báo khi trạng thái đơn hàng thay đổi
 * @param {*} order - Đơn hàng
 * @param {*} oldStatus - Trạng thái cũ
 * @param {*} newStatus - Trạng thái mới
 */
const sendOrderStatusNotification = async (order, oldStatus, newStatus) => {
  try {
    if (!order || !order.user || newStatus === oldStatus) return;

    let title = "";
    let message = "";

    switch (newStatus) {
      case "confirmed":
        title = "Đơn hàng đã được xác nhận";
        message = `Đơn hàng #${order.code} của bạn đã được xác nhận và đang được chuẩn bị.`;
        break;
      case "shipping":
        title = "Đơn hàng đang được giao";
        message = `Đơn hàng #${order.code} của bạn đang được giao đến địa chỉ của bạn.`;
        break;
      case "delivered":
        title = "Đơn hàng đã được giao thành công";
        message = `Đơn hàng #${order.code} của bạn đã được giao thành công. Cảm ơn bạn đã mua sắm!`;
        break;
      case "cancelled":
        title = "Đơn hàng đã bị hủy";
        message = `Đơn hàng #${order.code} của bạn đã bị hủy.`;
        break;
      default:
        return; // Không thông báo cho các trạng thái khác
    }

    await createNotification(order.user, {
      type: "order",
      title,
      message,
      relatedId: order._id,
      onModel: "Order",
    });
  } catch (error) {
    console.error("Lỗi khi gửi thông báo trạng thái đơn hàng:", error);
  }
};

/**
 * Áp dụng middlewares cho Order schema
 * @param {Schema} schema - Mongoose Schema
 */
const applyMiddlewares = (schema) => {
  // Xử lý trước khi lưu Order
  schema.pre("save", async function (next) {
    try {
      // Tạo mã đơn hàng nếu là đơn hàng mới
      if (this.isNew) {
        // Sử dụng phương thức mới để tạo mã không trùng
        this.code = await generateOrderCode();
      }

      // Lưu trạng thái cũ trước khi cập nhật
      if (this.isModified("status")) {
        this._previousStatus = this.isNew
          ? null
          : this.getOldValue
          ? this.getOldValue("status")
          : undefined;
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Xử lý sau khi lưu Order
  schema.post("save", async function (doc) {
    try {
      const previousStatus = this._previousStatus;
      const currentStatus = this.status;

      // Nếu là đơn hàng mới được tạo
      if (!previousStatus && currentStatus === "pending") {
        // Kiểm tra phương thức thanh toán
        if (this.payment.method === "COD" && !this.inventoryDeducted) {
          // Nếu thanh toán COD và chưa trừ tồn kho, giảm số lượng tồn kho
          for (const item of this.orderItems) {
            await updateInventory(item, "decrement");
          }
          
          // Cập nhật trạng thái không qua this.save() để tránh vòng lặp vô hạn
          await mongoose.model("Order").findByIdAndUpdate(
            this._id,
            { inventoryDeducted: true },
            { new: true }
          );
        }
        // Nếu là VNPAY, sẽ trừ khi thanh toán thành công
      }

      // Xử lý khi trạng thái đơn hàng thay đổi
      if (previousStatus && previousStatus !== currentStatus) {
        // Nếu đơn hàng bị hủy và đã trừ tồn kho, trả lại số lượng
        if (currentStatus === "cancelled" && this.inventoryDeducted) {
          for (const item of this.orderItems) {
            await updateInventory(item, "increment");
          }
          
          // Cập nhật trạng thái không qua this.save() để tránh vòng lặp vô hạn
          await mongoose.model("Order").findByIdAndUpdate(
            this._id,
            { inventoryDeducted: false },
            { new: true }
          );
        }

        // Gửi thông báo khi trạng thái đơn hàng thay đổi
        await sendOrderStatusNotification(this, previousStatus, currentStatus);
      }
    } catch (error) {
      console.error("Lỗi khi xử lý sau khi lưu đơn hàng:", error);
    }
  });

  // Xử lý trước khi cập nhật
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();
      const options = this.getOptions();

      // Chỉ quan tâm đến việc cập nhật trạng thái
      if (update.$set && update.$set.status) {
        const order = await this.model.findOne(this.getQuery());
        if (order) {
          this._orderId = order._id;
          this._oldStatus = order.status;
          this._order = order;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Xử lý sau khi cập nhật
  schema.post("findOneAndUpdate", async function (doc) {
    try {
      // Xử lý khi trạng thái đơn hàng thay đổi
      if (doc && this._oldStatus && doc.status !== this._oldStatus) {
        // Nếu đơn hàng bị hủy, trả lại số lượng tồn kho
        if (doc.status === "cancelled") {
          for (const item of doc.orderItems) {
            await updateInventory(item, "increment");
          }
        }

        // Gửi thông báo khi trạng thái đơn hàng thay đổi
        await sendOrderStatusNotification(doc, this._oldStatus, doc.status);
      }
    } catch (error) {
      console.error("Lỗi khi xử lý sau khi cập nhật đơn hàng:", error);
    }
  });
};

module.exports = { applyMiddlewares };