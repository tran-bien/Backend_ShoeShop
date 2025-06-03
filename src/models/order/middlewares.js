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
 * Tạo mã đơn hàng không trùng (cải thiện để tránh race condition)
 * @returns {String} Mã đơn hàng mới
 */
const generateOrderCode = async () => {
  const maxRetries = 5;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Tạo mã dựa trên timestamp để tránh trùng lặp
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2); // 2 số cuối của năm
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const day = now.getDate().toString().padStart(2, "0");
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const seconds = now.getSeconds().toString().padStart(2, "0");
      const milliseconds = now.getMilliseconds().toString().padStart(3, "0");

      // Format: ORD + YY + MM + DD + HH + MM + SS + milliseconds (3 chữ số cuối)
      const timeBasedCode = `ORD${year}${month}${day}${hours}${minutes}${seconds}${milliseconds.slice(
        -2
      )}`;

      // Kiểm tra xem mã này đã tồn tại chưa
      const existingOrder = await mongoose
        .model("Order")
        .findOne({ code: timeBasedCode });

      if (!existingOrder) {
        return timeBasedCode;
      }

      // Nếu trùng, thêm số ngẫu nhiên vào cuối
      const randomSuffix = Math.floor(Math.random() * 99)
        .toString()
        .padStart(2, "0");
      const finalCode = `${timeBasedCode}${randomSuffix}`;

      const duplicateCheck = await mongoose
        .model("Order")
        .findOne({ code: finalCode });

      if (!duplicateCheck) {
        return finalCode;
      }

      attempt++;

      // Chờ một chút trước khi thử lại
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 100));
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      attempt++;

      if (attempt >= maxRetries) {
        // Phương án cuối cùng: sử dụng timestamp + random
        const fallbackCode = `ORD${Date.now()}${Math.floor(
          Math.random() * 1000
        )}`;
        console.warn(`Using fallback code: ${fallbackCode}`);
        return fallbackCode;
      }

      // Chờ trước khi thử lại
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 200));
    }
  }

  // Nếu tất cả attempts đều thất bại, tạo mã với UUID
  const crypto = require("crypto");
  const uuid = crypto.randomUUID().replace(/-/g, "").substring(0, 8);
  return `ORD${Date.now().toString().slice(-6)}${uuid}`;
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
      if (this.isNew && !this.code) {
        // Thử tạo mã đơn hàng với retry logic
        let codeGenerated = false;
        let retryCount = 0;
        const maxRetries = 3;

        while (!codeGenerated && retryCount < maxRetries) {
          try {
            this.code = await generateOrderCode();
            codeGenerated = true;
          } catch (error) {
            retryCount++;
            console.error(
              `Retry ${retryCount} for generating order code:`,
              error
            );

            if (retryCount >= maxRetries) {
              // Tạo mã dự phòng đơn giản
              const timestamp = Date.now();
              const random = Math.floor(Math.random() * 10000);
              this.code = `ORD${timestamp}${random}`;
              console.warn(`Used emergency code: ${this.code}`);
            } else {
              // Chờ một chút trước khi thử lại
              await new Promise((resolve) =>
                setTimeout(resolve, 100 * retryCount)
              );
            }
          }
        }
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
