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
        // Đếm số lượng đơn hàng hiện tại để tạo mã
        const count = await mongoose.model("Order").countDocuments();
        this.code = `ORD${String(count + 1).padStart(6, "0")}`;
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

      // Nếu là đơn hàng mới được tạo, cập nhật inventory
      if (!previousStatus && currentStatus === "pending") {
        // Giảm số lượng tồn kho khi đơn hàng được tạo
        for (const item of this.orderItems) {
          await updateInventory(item, "decrement");
        }
      }

      // Xử lý khi trạng thái đơn hàng thay đổi
      if (previousStatus && previousStatus !== currentStatus) {
        // Nếu đơn hàng bị hủy, trả lại số lượng tồn kho
        if (currentStatus === "cancelled") {
          for (const item of this.orderItems) {
            await updateInventory(item, "increment");
          }
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
