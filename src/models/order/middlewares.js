const mongoose = require("mongoose");

/**
 * Cập nhật số lượng tồn kho từ đơn hàng (sử dụng InventoryItem)
 * @param {Object} orderItem Mặt hàng trong đơn hàng
 * @param {String} action 'decrement' hoặc 'increment'
 * @param {String} reason Lý do (return, cancelled, etc.)
 * @param {ObjectId} orderId ID đơn hàng
 * @param {ObjectId} performedBy Người thực hiện
 */
const updateInventory = async (
  orderItem,
  action,
  reason = "other",
  orderId = null,
  performedBy = null
) => {
  try {
    const inventoryService = require("@services/inventory.service");

    if (!orderItem.variant || !orderItem.size || !orderItem.quantity) return;

    // Lấy productId từ variant (vì orderItem không có trực tiếp product field)
    const Variant = mongoose.model("Variant");
    const variant = await Variant.findById(orderItem.variant).select("product");

    if (!variant || !variant.product) {
      console.error(
        `[order/middlewares] Không tìm thấy product từ variant ${orderItem.variant}`
      );
      return;
    }

    // Chỉ xử lý khi action là increment (trả hàng về kho)
    if (action === "increment") {
      await inventoryService.stockIn(
        {
          product: variant.product,
          variant: orderItem.variant,
          size: orderItem.size,
          quantity: orderItem.quantity,
          costPrice: 0, // Không có giá nhập khi trả hàng
          reason: reason,
          reference: orderId
            ? {
                type: "Order",
                id: orderId,
              }
            : undefined,
          notes: `Nhập kho tự động: ${
            reason === "return"
              ? "Trả hàng"
              : reason === "cancelled"
              ? "Hủy đơn"
              : "Điều chỉnh"
          }`,
        },
        performedBy
      );

      console.log(
        `[order/middlewares] Đã trả ${orderItem.quantity} sản phẩm về kho (reason: ${reason})`
      );
    }
    // Action decrement không cần xử lý vì đã xuất kho tự động khi gán shipper
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

      // ============================================================
      // EMAIL NOTIFICATIONS - Gửi email khi status thay đổi
      // ============================================================
      if (previousStatus && previousStatus !== currentStatus) {
        try {
          const emailService = require("@services/email.service");
          const notificationService = require("@services/notification.service");

          // Populate order để có đầy đủ thông tin cho email
          const Order = mongoose.model("Order");
          const populatedOrder = await Order.findById(this._id).populate([
            { path: "user", select: "name email preferences" },
            {
              path: "orderItems.variant",
              select: "product color images",
              populate: { path: "product", select: "name" },
            },
            { path: "orderItems.size", select: "value" },
          ]);

          // Check user preferences - có muốn nhận email không
          const userPreferences = populatedOrder.user.preferences || {};
          const emailEnabled =
            userPreferences.emailNotifications?.orderUpdates !== false;

          // Gửi email dựa trên status mới
          switch (currentStatus) {
            case "confirmed":
              // Đơn hàng được xác nhận
              if (emailEnabled) {
                await emailService.sendOrderConfirmationEmail(
                  populatedOrder.user._id,
                  populatedOrder
                );
                console.log(
                  `[EMAIL] Đã gửi email xác nhận đơn hàng ${this.code}`
                );
              } else {
                console.log(
                  `[EMAIL] User tắt email notification, skip email cho đơn ${this.code}`
                );
              }

              await notificationService.send(
                populatedOrder.user._id,
                "ORDER_CONFIRMED",
                {
                  orderCode: populatedOrder.code,
                  orderId: populatedOrder._id.toString(),
                },
                { channels: { inApp: true, email: false } } // Email đã gửi riêng
              );
              break;

            case "shipping":
            case "out_for_delivery":
              // Đơn hàng đang giao
              await notificationService.send(
                populatedOrder.user._id,
                "ORDER_SHIPPING",
                {
                  orderCode: populatedOrder.code,
                  orderId: populatedOrder._id.toString(),
                },
                { channels: { inApp: true, email: emailEnabled } }
              );
              console.log(
                `[EMAIL] ${
                  emailEnabled ? "Đã gửi" : "Skip"
                } thông báo đơn hàng đang giao ${this.code}`
              );
              break;

            case "delivered":
              // Đơn hàng đã giao thành công
              await notificationService.send(
                populatedOrder.user._id,
                "ORDER_DELIVERED",
                {
                  orderCode: populatedOrder.code,
                  orderId: populatedOrder._id.toString(),
                },
                { channels: { inApp: true, email: emailEnabled } }
              );
              console.log(
                `[EMAIL] ${
                  emailEnabled ? "Đã gửi" : "Skip"
                } thông báo giao hàng thành công ${this.code}`
              );
              break;

            case "cancelled":
              // Đơn hàng bị hủy
              await notificationService.send(
                populatedOrder.user._id,
                "ORDER_CANCELLED",
                {
                  orderCode: populatedOrder.code,
                  orderId: populatedOrder._id.toString(),
                  reason: this.cancelReason || "Không rõ lý do",
                },
                { channels: { inApp: true, email: emailEnabled } }
              );
              console.log(
                `[EMAIL] ${
                  emailEnabled ? "Đã gửi" : "Skip"
                } thông báo hủy đơn ${this.code}`
              );
              break;
          }
        } catch (emailError) {
          // Không throw error để không ảnh hưởng đến flow chính
          console.error(
            `[EMAIL] Lỗi gửi email cho đơn ${this.code}:`,
            emailError.message
          );
        }
      }

      // LOYALTY: Tích điểm khi đơn hàng delivered
      if (
        currentStatus === "delivered" &&
        previousStatus !== "delivered" &&
        this.payment.paymentStatus === "paid" &&
        !this.loyaltyPointsAwarded // Tránh tích 2 lần
      ) {
        try {
          const loyaltyService = require("@services/loyalty.service");
          const pointsToEarn = loyaltyService.calculatePointsFromOrder(
            this.totalAfterDiscountAndShipping
          );

          if (pointsToEarn > 0) {
            await loyaltyService.addPoints(this.user, pointsToEarn, {
              source: "ORDER",
              order: this._id,
              description: `Tích điểm từ đơn hàng ${this.code}`,
            });

            // Đánh dấu đã tích điểm
            await mongoose.model("Order").updateOne(
              { _id: this._id },
              {
                loyaltyPointsEarned: pointsToEarn,
                loyaltyPointsAwarded: true,
              }
            );

            console.log(
              `[LOYALTY] User ${this.user} nhận ${pointsToEarn} điểm từ đơn ${this.code}`
            );
          }
        } catch (error) {
          console.error("[LOYALTY] Lỗi khi tích điểm:", error);
        }
      }

      // Chỉ xử lý khi có sự thay đổi trạng thái thực sự
      if (previousStatus && previousStatus !== currentStatus) {
        // ============================================================
        // XỬ LÝ TỒN KHO KHI ĐƠN HÀNG THAY ĐỔI TRẠNG THÁI
        // ============================================================

        // CASE 1: ĐƠN HÀNG BỊ HỦY (cancelled, refunded)
        // → NHẬP KHO NGAY, không cần returnConfirmed
        if (
          (currentStatus === "cancelled" || currentStatus === "refunded") &&
          this.inventoryDeducted &&
          !this.inventoryRestored
        ) {
          console.log(
            `[Order ${this.code}] Đơn hàng bị ${currentStatus}, hoàn trả tồn kho NGAY`
          );

          for (const item of this.orderItems) {
            await updateInventory(
              item,
              "increment",
              currentStatus === "cancelled" ? "cancelled" : "refunded",
              this._id,
              this.user
            );
          }

          // Đánh dấu đã hoàn kho
          await mongoose.model("Order").updateOne(
            { _id: this._id },
            {
              inventoryRestored: true,
              inventoryDeducted: false,
            }
          );

          console.log(`[Order ${this.code}] Đã hoàn trả tồn kho`);
        }

        // CASE 2: ĐƠN HÀNG TRẢ HÀNG (returned)
        // → CHỈ nhập kho KHI returnConfirmed = true (Staff đã xác nhận nhận hàng)
        else if (
          currentStatus === "returned" &&
          this.inventoryDeducted &&
          !this.inventoryRestored
        ) {
          if (!this.returnConfirmed) {
            console.log(
              `[Order ${this.code}] Trả hàng nhưng CHƯA xác nhận nhận hàng. Chờ staff xác nhận.`
            );
          } else {
            console.log(
              `[Order ${this.code}] Trả hàng và ĐÃ xác nhận nhận hàng. Hoàn trả tồn kho.`
            );

            for (const item of this.orderItems) {
              await updateInventory(
                item,
                "increment",
                "return",
                this._id,
                this.user
              );
            }

            // Đánh dấu đã hoàn kho
            await mongoose.model("Order").updateOne(
              { _id: this._id },
              {
                inventoryRestored: true,
                inventoryDeducted: false,
              }
            );

            console.log(`[Order ${this.code}] Đã hoàn trả tồn kho`);
          }
        }

        // CASE 3: HÀNG ĐANG TRẢ VỀ KHO (returning_to_warehouse)
        // → Không làm gì, chờ Staff xác nhận
        else if (currentStatus === "returning_to_warehouse") {
          console.log(
            `[Order ${this.code}] Hàng đang trả về kho, chờ Staff xác nhận nhận hàng`
          );
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
        console.log(
          `[post findOneAndUpdate] Đơn hàng ${doc.code}: ${doc._oldStatus} → ${doc.status}`
        );

        // ============================================================
        // XỬ LÝ TỒN KHO KHI ĐƠN HÀNG THAY ĐỔI TRẠNG THÁI
        // ============================================================

        // CASE 1: ĐƠN HÀNG BỊ HỦY (cancelled, refunded)
        // → NHẬP KHO NGAY, không cần returnConfirmed
        if (
          (doc.status === "cancelled" || doc.status === "refunded") &&
          doc.inventoryDeducted &&
          !doc.inventoryRestored
        ) {
          console.log(
            `[post findOneAndUpdate] [Order ${doc.code}] Đơn hàng bị ${doc.status}, hoàn trả tồn kho NGAY`
          );

          for (const item of doc.orderItems) {
            await updateInventory(
              item,
              "increment",
              doc.status === "cancelled" ? "cancelled" : "refunded",
              doc._id,
              doc.user
            );
          }

          // Cập nhật trạng thái
          await mongoose.model("Order").findByIdAndUpdate(
            doc._id,
            {
              inventoryRestored: true,
              inventoryDeducted: false,
            },
            { new: true }
          );

          console.log(
            `[post findOneAndUpdate] [Order ${doc.code}] Đã hoàn trả tồn kho`
          );
        }

        // CASE 2: ĐƠN HÀNG TRẢ HÀNG (returned)
        // → CHỈ nhập kho KHI returnConfirmed = true (Staff đã xác nhận nhận hàng)
        else if (
          doc.status === "returned" &&
          doc.inventoryDeducted &&
          !doc.inventoryRestored
        ) {
          if (!doc.returnConfirmed) {
            console.log(
              `[post findOneAndUpdate] [Order ${doc.code}] Trả hàng nhưng CHƯA xác nhận nhận hàng. Chờ staff xác nhận.`
            );
          } else {
            console.log(
              `[post findOneAndUpdate] [Order ${doc.code}] Trả hàng và ĐÃ xác nhận nhận hàng. Hoàn trả tồn kho.`
            );

            for (const item of doc.orderItems) {
              await updateInventory(
                item,
                "increment",
                "return",
                doc._id,
                doc.user
              );
            }

            // Cập nhật trạng thái
            await mongoose.model("Order").findByIdAndUpdate(
              doc._id,
              {
                inventoryRestored: true,
                inventoryDeducted: false,
              },
              { new: true }
            );

            console.log(
              `[post findOneAndUpdate] [Order ${doc.code}] Đã hoàn trả tồn kho`
            );
          }
        }

        // CASE 3: HÀNG ĐANG TRẢ VỀ KHO (returning_to_warehouse)
        // → Không làm gì, chờ Staff xác nhận
        else if (doc.status === "returning_to_warehouse") {
          console.log(
            `[post findOneAndUpdate] [Order ${doc.code}] Hàng đang trả về kho, chờ Staff xác nhận nhận hàng`
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
