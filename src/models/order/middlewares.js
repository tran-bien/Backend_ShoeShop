const mongoose = require("mongoose");
// const { createNotification } = require("../services/notification.service");

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
 * Gửi thông báo cho người dùng về trạng thái đơn hàng
 * Hiện tại đã được comment để triển khai sau
 */
/*
const sendOrderStatusNotification = async (
  order,
  previousStatus,
  newStatus
) => {
  try {
    if (!order.user) return;

    let title, content;
    switch (newStatus) {
      case "confirmed":
        title = "Đơn hàng đã được xác nhận";
        content = `Đơn hàng #${order.code} của bạn đã được xác nhận và đang được chuẩn bị.`;
        break;
      case "shipping":
        title = "Đơn hàng đang được giao";
        content = `Đơn hàng #${order.code} của bạn đang được giao đến địa chỉ của bạn.`;
        break;
      case "delivered":
        title = "Đơn hàng đã giao thành công";
        content = `Đơn hàng #${order.code} đã được giao thành công. Cảm ơn bạn đã mua hàng!`;
        break;
      case "cancelled":
        title = "Đơn hàng đã bị hủy";
        content = `Đơn hàng #${order.code} của bạn đã bị hủy.`;
        break;
      default:
        return;
    }

    await createNotification(order.user, {
      type: "order_status",
      title,
      content,
      refId: order._id,
      refModel: "Order",
    });

    console.log(
      `[order/middlewares] Đã gửi thông báo về đơn hàng ${order.code}`
    );
  } catch (error) {
    console.error(`[order/middlewares] Lỗi gửi thông báo: ${error.message}`);
  }
};
*/

/**
 * Áp dụng middleware cho Order Schema
 */
const applyMiddlewares = (schema) => {
  // Tạo mã đơn hàng trước khi lưu
  schema.pre("save", async function (next) {
    try {
      if (this.isNew) {
        // Tạo mã đơn hàng theo định dạng: ORD-YYYYMMDD-XXXX
        const date = new Date();
        const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");

        // Tìm số đơn hàng lớn nhất trong ngày
        const Order = mongoose.model("Order");
        const lastOrder = await Order.findOne({
          code: new RegExp(`^ORD-${dateStr}-`),
        }).sort({ code: -1 });

        let sequence = 1;
        if (lastOrder) {
          const lastSequence = parseInt(lastOrder.code.split("-")[2]);
          if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
          }
        }

        this.code = `ORD-${dateStr}-${sequence.toString().padStart(4, "0")}`;

        // Thiết lập trạng thái ban đầu và thêm vào lịch sử
        if (!this.status) {
          this.status = "pending";
        }

        // Thêm trạng thái ban đầu vào lịch sử
        this.statusHistory = [
          {
            status: this.status,
            updatedAt: new Date(),
            updatedBy: this.user, // Người dùng tạo đơn
            note: "Đơn hàng được tạo",
          },
        ];
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Cập nhật tổng giá trị đơn hàng, tính phí ship và discount trước khi lưu
  schema.pre("save", async function (next) {
    try {
      // Tính subTotal dựa trên orderItems (giá * số lượng)
      let computedSubTotal = 0;
      if (this.orderItems && this.orderItems.length > 0) {
        this.orderItems.forEach((item) => {
          computedSubTotal += item.price * item.quantity;
        });
      }
      this.subTotal = computedSubTotal;

      // Tính discount từ coupon (nếu có)
      if (this.coupon) {
        const Coupon = mongoose.model("Coupon");
        const coupon = await Coupon.findById(this.coupon);
        if (coupon && coupon.isActive) {
          // Lưu chi tiết coupon để tránh reference
          this.couponDetail = {
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscountAmount: coupon.maxDiscountAmount,
          };

          // Tính discount
          if (coupon.discountType === "percent") {
            this.discount = Math.min(
              (this.subTotal * coupon.discountValue) / 100,
              coupon.maxDiscountAmount || Infinity
            );
          } else {
            this.discount = Math.min(coupon.discountValue, this.subTotal);
          }
        } else {
          this.discount = 0;
        }
      } else {
        this.discount = 0;
      }

      // Tính phí ship: mặc định là 30000, miễn ship nếu có > 2 sản phẩm và subTotal >= 1,000,000
      let totalItems = 0;
      if (this.orderItems) {
        this.orderItems.forEach((item) => {
          totalItems += item.quantity;
        });
      }

      if (totalItems > 2 && this.subTotal >= 1000000) {
        this.shippingFee = 0;
      } else {
        this.shippingFee = 30000;
      }

      // Tính tổng đơn hàng sau khi trừ discount và cộng phí ship
      this.totalAfterDiscountAndShipping =
        this.subTotal - this.discount + this.shippingFee;

      next();
    } catch (error) {
      next(error);
    }
  });

  // Lưu trạng thái trước khi cập nhật
  schema.pre("save", function (next) {
    if (this.isModified("status")) {
      this._previousStatus = this.getOldValue
        ? this.getOldValue("status")
        : this._previousStatus;
    }

    // Xử lý cập nhật trạng thái thanh toán
    if (this.isModified("payment.paymentStatus")) {
      const newStatus = this.payment.paymentStatus;
      const oldStatus = this.getOldValue
        ? this.getOldValue("payment.paymentStatus")
        : null;

      // Thêm vào lịch sử thanh toán
      if (newStatus !== oldStatus) {
        if (!this.paymentHistory) {
          this.paymentHistory = [];
        }

        this.paymentHistory.push({
          status: newStatus,
          transactionId: this.payment.transactionId,
          amount: this.totalAfterDiscountAndShipping,
          method: this.payment.method,
          updatedAt: new Date(),
        });

        // Cập nhật thời gian thanh toán nếu đã thanh toán
        if (newStatus === "paid" && !this.payment.paidAt) {
          this.payment.paidAt = new Date();
        }
      }
    }

    next();
  });

  // Middleware sau khi lưu đơn hàng
  schema.post("save", async function () {
    try {
      if (this.isNew) {
        // Đơn hàng mới tạo - giảm số lượng tồn kho
        for (const item of this.orderItems) {
          await updateInventory(item, "decrement");
        }
        console.log(
          `[order/middlewares] Đơn hàng mới #${this.code}: đã cập nhật tồn kho`
        );
      } else if (this.isModified && this.isModified("status")) {
        // Đơn hàng thay đổi trạng thái
        const newStatus = this.status;
        const prevStatus = this._previousStatus;

        // Nếu hủy đơn hàng - khôi phục số lượng tồn kho
        if (
          newStatus === "cancelled" &&
          ["pending", "confirmed", "shipping"].includes(prevStatus)
        ) {
          for (const item of this.orderItems) {
            await updateInventory(item, "increment");
          }
          console.log(
            `[order/middlewares] Đơn hàng #${this.code} bị hủy: đã khôi phục tồn kho`
          );
        }

        // Thêm vào lịch sử trạng thái nếu có thay đổi
        if (newStatus !== prevStatus) {
          if (!this.statusHistory) {
            this.statusHistory = [];
          }

          // Thêm trạng thái mới vào lịch sử
          this.statusHistory.push({
            status: newStatus,
            updatedAt: new Date(),
            updatedBy: this._updatedBy || null,
            note:
              this._statusNote ||
              `Trạng thái đơn hàng thay đổi từ ${prevStatus} sang ${newStatus}`,
          });

          // COMMENT: Gửi thông báo cho người dùng - sẽ bật khi triển khai notification
          // await sendOrderStatusNotification(this, prevStatus, newStatus);
        }
      }
    } catch (error) {
      console.error(
        `[order/middlewares] Lỗi xử lý sau khi lưu đơn hàng: ${error.message}`
      );
    }
  });

  // Xử lý khi cập nhật đơn hàng
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();

      // Lưu thông tin trạng thái cũ
      if (update.$set && update.$set.status) {
        const doc = await this.model.findOne(this.getQuery());
        this._oldStatus = doc ? doc.status : null;
        this._orderId = doc ? doc._id : null;

        // Lưu thông tin người cập nhật và ghi chú
        if (update.$set.updatedBy) {
          this._updatedBy = update.$set.updatedBy;
          delete update.$set.updatedBy; // Xóa để không lưu vào trường không tồn tại
        }

        if (update.$set.statusNote) {
          this._statusNote = update.$set.statusNote;
          delete update.$set.statusNote; // Xóa để không lưu vào trường không tồn tại
        }

        // Thêm vào lịch sử trạng thái
        if (this._oldStatus !== update.$set.status) {
          const historyEntry = {
            status: update.$set.status,
            updatedAt: new Date(),
            updatedBy: this._updatedBy,
            note:
              this._statusNote ||
              `Trạng thái đơn hàng thay đổi từ ${this._oldStatus} sang ${update.$set.status}`,
          };

          // Sử dụng $push để thêm vào mảng statusHistory
          if (!update.$push) update.$push = {};
          update.$push.statusHistory = historyEntry;
        }
      }

      // Xử lý cập nhật trạng thái thanh toán
      if (update.$set && update.$set["payment.paymentStatus"]) {
        const doc = await this.model.findOne(this.getQuery());
        this._oldPaymentStatus = doc?.payment?.paymentStatus;

        if (this._oldPaymentStatus !== update.$set["payment.paymentStatus"]) {
          const paymentHistoryEntry = {
            status: update.$set["payment.paymentStatus"],
            transactionId:
              update.$set["payment.transactionId"] ||
              doc?.payment?.transactionId,
            amount: doc?.totalAfterDiscountAndShipping,
            method: doc?.payment?.method,
            updatedAt: new Date(),
          };

          // Sử dụng $push để thêm vào mảng paymentHistory
          if (!update.$push) update.$push = {};
          update.$push.paymentHistory = paymentHistoryEntry;

          // Cập nhật thời gian thanh toán nếu đã thanh toán
          if (update.$set["payment.paymentStatus"] === "paid") {
            if (!update.$set["payment.paidAt"]) {
              update.$set["payment.paidAt"] = new Date();
            }
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  schema.post("findOneAndUpdate", async function (doc) {
    try {
      if (doc) {
        // Xử lý khi hủy đơn hàng
        if (
          this._oldStatus &&
          doc.status !== this._oldStatus &&
          doc.status === "cancelled" &&
          ["pending", "confirmed", "shipping"].includes(this._oldStatus)
        ) {
          for (const item of doc.orderItems) {
            await updateInventory(item, "increment");
          }
          console.log(
            `[order/middlewares] Đơn hàng #${doc.code} bị hủy: đã khôi phục tồn kho`
          );
        }

        // COMMENT: Gửi thông báo cho người dùng - sẽ bật khi triển khai notification
        /*
        if (this._oldStatus && doc.status !== this._oldStatus) {
          await sendOrderStatusNotification(doc, this._oldStatus, doc.status);
        }
        */
      }
    } catch (error) {
      console.error(
        `[order/middlewares] Lỗi xử lý sau khi cập nhật đơn hàng: ${error.message}`
      );
    }
  });
};

module.exports = {
  applyMiddlewares,
  updateInventory,
};
