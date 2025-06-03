const mongoose = require("mongoose");

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
    const latestOrder = await mongoose
      .model("Order")
      .findOne()
      .sort({ createdAt: -1 });

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
    const randomPart = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, "0");
    return `ORD${randomPart}`;
  }
};

/**
 * Kiểm tra xem đã có bản ghi tương tự trong lịch sử trạng thái gần đây chưa
 * @param {Array} statusHistory - Mảng lịch sử trạng thái
 * @param {String} status - Trạng thái cần kiểm tra
 * @param {Number} timeThresholdMs - Ngưỡng thời gian (mili giây)
 * @returns {Boolean} - true nếu đã có bản ghi tương tự gần đây
 */
const hasSimilarRecentEntry = (
  statusHistory,
  status,
  timeThresholdMs = 5000
) => {
  if (!statusHistory || !statusHistory.length) return false;

  const now = new Date();
  const recentEntries = statusHistory.filter((entry) => {
    if (entry.status !== status) return false;
    const entryTime = new Date(entry.updatedAt);
    const timeDiff = now - entryTime;
    return timeDiff < timeThresholdMs; // Trong khoảng 5 giây
  });

  return recentEntries.length > 0;
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

      // Chỉ xử lý khi có sự thay đổi trạng thái thực sự
      if (previousStatus && previousStatus !== currentStatus) {
        // Xử lý tồn kho - CHỈ KHI HỦY ĐƠN HÀNG
        if (currentStatus === "cancelled" && this.inventoryDeducted) {
          console.log(
            `Đang hoàn trả tồn kho cho đơn hàng bị hủy: ${this.code}`
          );
          // Nếu đơn hàng bị hủy và đã trừ tồn kho, trả lại số lượng
          for (const item of this.orderItems) {
            await updateInventory(item, "increment");
          }

          // Cập nhật trạng thái không qua this.save()
          await mongoose
            .model("Order")
            .updateOne({ _id: this._id }, { inventoryDeducted: false });
          console.log(`Đã hoàn trả tồn kho cho đơn hàng: ${this.code}`);
        }

        // Thêm statusHistory - giữ nguyên logic này
        if (
          !this._statusHistoryAdded &&
          !hasSimilarRecentEntry(this.statusHistory, currentStatus)
        ) {
          const statusEntry = {
            status: currentStatus,
            updatedAt: new Date(),
            note: `Trạng thái đơn hàng thay đổi từ ${previousStatus} sang ${currentStatus}`,
          };

          await mongoose
            .model("Order")
            .updateOne(
              { _id: this._id },
              { $push: { statusHistory: statusEntry } }
            );
        }
      }

      // Xóa marker nếu có
      if (this._statusHistoryAdded) {
        await mongoose
          .model("Order")
          .updateOne(
            { _id: this._id },
            { $unset: { _statusHistoryAdded: "" } }
          );
      }
    } catch (error) {
      console.error("[Order]: Lỗi trong middleware post-save:", error);
    }
  });

  // Xử lý sau khi tìm thấy và cập nhật document - giữ nguyên
  schema.post("findOneAndUpdate", async function (doc) {
    try {
      if (!doc) return;

      // Xử lý cập nhật trạng thái
      if (doc._oldStatus && doc._oldStatus !== doc.status) {
        if (doc.status === "cancelled" && doc.inventoryDeducted) {
          // Nếu đơn hàng bị hủy và đã trừ tồn kho, trả lại số lượng
          for (const item of doc.orderItems) {
            await updateInventory(item, "increment");
          }

          // Cập nhật trạng thái
          await mongoose
            .model("Order")
            .findByIdAndUpdate(
              doc._id,
              { inventoryDeducted: false },
              { new: true }
            );
        } else if (
          doc._oldStatus === "cancelled" &&
          doc.status !== "cancelled" &&
          !doc.inventoryDeducted
        ) {
          // Nếu đơn hàng từ trạng thái hủy => không hủy, trừ lại tồn kho
          for (const item of doc.orderItems) {
            await updateInventory(item, "decrement");
          }

          // Cập nhật trạng thái
          await mongoose
            .model("Order")
            .findByIdAndUpdate(
              doc._id,
              { inventoryDeducted: true },
              { new: true }
            );
        }
      }
    } catch (error) {
      console.error(
        "[Order]: Lỗi trong middleware post-findOneAndUpdate:",
        error
      );
    }
  });

  // Thiết lập virtual cho email người dùng
  schema.virtual("userEmail").get(function () {
    return this.user?.email || "Không có email";
  });
};

module.exports = { applyMiddlewares };
