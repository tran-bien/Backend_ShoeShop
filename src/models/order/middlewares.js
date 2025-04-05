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
 * Áp dụng middleware cho Order Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
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

        // Thiết lập trạng thái ban đầu
        if (!this.status) {
          this.status = "pending";
        }
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
        if (coupon && coupon.isValid) {
          // Giả sử coupon có các field discountType và discountValue
          if (coupon.discountType === "percent") {
            this.discount = (this.subTotal * coupon.discountValue) / 100;
          } else {
            this.discount = coupon.discountValue;
          }
        } else {
          this.discount = 0;
        }
      } else {
        this.discount = 0;
      }

      // Tính phí ship: mặc định là 30000, miễn ship nếu có > 2 sản phẩm và subTotal >= 1,000,000
      if (
        this.orderItems &&
        this.orderItems.length > 2 &&
        this.subTotal >= 1000000
      ) {
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
      this._previousStatus = this.get("status", String);
    }
    next();
  });

  // Cải tiến middleware sau khi lưu đơn hàng
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
      } else if (this.isModified("status")) {
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
      }
    } catch (error) {
      console.error(
        `[order/middlewares] Lỗi xử lý sau khi lưu đơn hàng: ${error.message}`
      );
    }
  });

  // Kiểm tra tính hợp lệ của trạng thái
  schema.pre("validate", function (next) {
    const validStatuses = [
      "pending",
      "confirmed",
      "shipping",
      "delivered",
      "cancelled",
    ];

    if (this.status && !validStatuses.includes(this.status)) {
      this.invalidate("status", `Trạng thái không hợp lệ: ${this.status}`);
      return next(new Error(`Trạng thái không hợp lệ: ${this.status}`));
    }

    next();
  });

  // Tự động cập nhật trạng thái đơn hàng dựa trên thời gian
  schema.pre("save", function (next) {
    // Nếu trạng thái thanh toán (paid) và chưa có thời gian thanh toán, cập nhật vào payment.paidAt
    if (
      this.payment &&
      this.payment.paymentStatus === "paid" &&
      !this.payment.paidAt
    ) {
      this.payment.paidAt = new Date();
    }
    next();
  });

  // Xử lý khi cập nhật đơn hàng
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();
      if (update.$set && update.$set.status) {
        const doc = await this.model.findOne(this.getQuery());
        this._oldStatus = doc ? doc.status : null;
        this._orderId = doc ? doc._id : null;
      }

      // Nếu đang khôi phục đơn hàng (đặt deletedAt thành null)
      if (update && update.$set && update.$set.deletedAt === null) {
        try {
          const doc = await this.model.findOne(this.getFilter(), {
            includeDeleted: true,
          });

          if (doc && doc.code) {
            // Kiểm tra xem có đơn hàng nào khác đang dùng code này không
            const duplicate = await this.model.findOne({
              code: doc.code,
              _id: { $ne: doc._id },
              deletedAt: null,
            });

            if (duplicate) {
              // Nếu có, tạo một code mới bằng cách thêm hậu tố thời gian
              const parts = doc.code.split("-");
              const newCode = `${parts[0]}-${parts[1]}-${Date.now()}`;
              update.$set.code = newCode;
              console.log(
                `Code bị trùng khi khôi phục, đã tạo code mới: ${newCode}`
              );
            }
          }
        } catch (error) {
          console.error("Lỗi khi kiểm tra code khi khôi phục đơn hàng:", error);
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  schema.post("findOneAndUpdate", async function (doc) {
    try {
      if (doc && this._oldStatus && doc.status !== this._oldStatus) {
        // Xử lý khi hủy đơn hàng
        if (
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
