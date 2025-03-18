const mongoose = require("mongoose");

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

        // Xóa đoạn code tạo statusHistory
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

  // Cập nhật kho sau khi đơn hàng được tạo
  schema.post("save", async function () {
    try {
      if (this.isNew) {
        const Product = mongoose.model("Product");

        // Giảm số lượng tồn kho cho mỗi sản phẩm trong đơn hàng
        const updatePromises = this.orderItems.map(async (item) => {
          if (item.product && item.variant && item.quantity) {
            const product = await Product.findById(item.product);
            if (product) {
              await product.updateVariantStock(item.variant, -item.quantity);
            }
          }
        });

        await Promise.all(updatePromises);
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật kho sau khi tạo đơn hàng:", error);
    }
  });

  // Cập nhật kho khi đơn hàng bị hủy
  schema.post("save", async function () {
    try {
      // Kiểm tra nếu trạng thái vừa được cập nhật thành cancelled
      const statusChanged = this.isModified("status");
      const newStatus = this.status;
      const previousStatus = this._previousStatus;

      if (
        statusChanged &&
        newStatus === "cancelled" &&
        previousStatus !== "cancelled"
      ) {
        const Product = mongoose.model("Product");

        // Tăng số lượng tồn kho cho mỗi sản phẩm trong đơn hàng
        const updatePromises = this.orderItems.map(async (item) => {
          if (item.product && item.variant && item.quantity) {
            const product = await Product.findById(item.product);
            if (product) {
              await product.updateVariantStock(item.variant, item.quantity);
            }
          }
        });

        await Promise.all(updatePromises);
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật kho sau khi hủy đơn hàng:", error);
    }
  });

  // Lưu trạng thái trước khi cập nhật
  schema.pre("save", function (next) {
    if (this.isModified("status")) {
      this._previousStatus = this.get("status", String);
    }
    next();
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
    if (this.status === "paid" && (!this.payment || !this.payment.paidAt)) {
      if (!this.payment) this.payment = {};
      this.payment.paidAt = new Date();
    }
    next();
  });
};

module.exports = { applyMiddlewares };
