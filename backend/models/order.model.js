const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    orderCode: {
      type: String,
      unique: true,
      required: [true, "Mã đơn hàng là bắt buộc"],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "ID người dùng là bắt buộc"],
    },
    orderItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: [true, "ID sản phẩm là bắt buộc"],
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          required: [true, "ID biến thể là bắt buộc"],
        },
        quantity: {
          type: Number,
          required: [true, "Số lượng là bắt buộc"],
          min: [1, "Số lượng phải lớn hơn 0"],
        },
        price: {
          type: Number,
          required: [true, "Giá sản phẩm là bắt buộc"],
          min: [0, "Giá sản phẩm không được âm"],
        },
      },
    ],
    subTotal: {
      type: Number,
      required: [true, "Tổng tiền sản phẩm là bắt buộc"],
      min: [0, "Tổng tiền sản phẩm không được âm"],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Số tiền giảm giá không được âm"],
    },
    totalAmount: {
      type: Number,
      required: [true, "Tổng tiền đơn hàng là bắt buộc"],
      min: [0, "Tổng tiền đơn hàng không được âm"],
    },
    totalProfit: {
      type: Number,
      default: 0,
      min: [0, "Tổng lợi nhuận không được âm"],
    },
    shippingPrice: {
      type: Number,
      default: 0,
      min: [0, "Phí vận chuyển không được âm"],
    },
    status: {
      type: String,
      default: "pending",
      enum: {
        values: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
        message: "Trạng thái đơn hàng không hợp lệ",
      },
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ["COD", "VNPAY"],
        message: "Phương thức thanh toán không hợp lệ",
      },
      required: [true, "Phương thức thanh toán là bắt buộc"],
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ["pending", "paid", "failed"],
        message: "Trạng thái thanh toán không hợp lệ",
      },
      default: "pending",
    },
    customerInfo: {
      name: {
        type: String,
        required: [true, "Tên khách hàng là bắt buộc"],
        trim: true,
      },
      phone: {
        type: String,
        required: [true, "Số điện thoại là bắt buộc"],
        match: [/^[0-9]{10,11}$/, "Số điện thoại không hợp lệ"],
      },
      province: {
        type: String,
        required: [true, "Tỉnh/thành phố là bắt buộc"],
      },
      district: { type: String, required: [true, "Quận/huyện là bắt buộc"] },
      ward: { type: String, required: [true, "Phường/xã là bắt buộc"] },
      addressDetail: {
        type: String,
        required: [true, "Địa chỉ chi tiết là bắt buộc"],
      },
    },
    note: {
      type: String,
      default: "",
      maxlength: [500, "Ghi chú không được vượt quá 500 ký tự"],
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
    },
    couponCode: {
      type: String,
    },
    trackingInfo: {
      carrier: { type: String },
      trackingNumber: { type: String },
      trackingUrl: { type: String },
    },
    cancellationReason: {
      type: String,
      maxlength: [500, "Lý do hủy không được vượt quá 500 ký tự"],
    },
    cancelledAt: {
      type: Date,
    },
    confirmedAt: {
      type: Date,
    },
    shippedAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    vnpayTransactionData: {
      type: Object,
    },
    paymentCode: {
      type: String,
      sparse: true,
      index: true,
    },
    paymentInfo: {
      type: Object,
    },
    statusHistory: [
      {
        status: {
          type: String,
          required: true,
          enum: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
        },
        date: {
          type: Date,
          default: Date.now,
        },
        description: String,
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
  },
  { timestamps: true }
);

// Middleware trước khi validate
OrderSchema.pre("validate", async function (next) {
  // Tự động tạo mã đơn hàng nếu chưa có
  if (!this.orderCode) {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-6);
    const randomNum = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0");
    this.orderCode = `OD${date.getFullYear()}${(date.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${date
      .getDate()
      .toString()
      .padStart(2, "0")}-${timestamp}${randomNum}`;
  }

  // Tính toán tổng tiền nếu có thay đổi trong orderItems
  if (this.isModified("orderItems")) {
    this.itemsPrice = this.orderItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    // Tính tổng tiền cuối cùng
    this.totalPrice =
      this.itemsPrice + this.shippingPrice - this.discountAmount;
  }

  // Kiểm tra tính hợp lệ của các sản phẩm trong đơn hàng
  const Product = mongoose.model("Product");
  for (const item of this.orderItems) {
    const product = await Product.findById(item.product);
    if (!product || product.isDeleted) {
      return next(new Error("Sản phẩm không tồn tại hoặc đã bị xóa"));
    }

    const variant = product.variants.find(
      (v) => v._id.toString() === item.variant.toString()
    );
    if (!variant) {
      return next(new Error("Biến thể sản phẩm không tồn tại"));
    }

    const sizeItem = variant.sizes.find(
      (s) => s.size.toString() === item.size.toString()
    );
    if (!sizeItem) {
      return next(new Error("Kích thước không tồn tại trong biến thể này"));
    }

    if (sizeItem.quantity < item.quantity) {
      return next(new Error("Không đủ số lượng trong kho"));
    }
  }

  next();
});

// Validate toàn bộ đơn hàng trước khi lưu
OrderSchema.pre("save", function (next) {
  // Kiểm tra đơn hàng phải có ít nhất 1 sản phẩm
  if (this.isNew && (!this.orderItems || this.orderItems.length === 0)) {
    return next(new Error("Đơn hàng phải có ít nhất một sản phẩm"));
  }

  // Kiểm tra tổng tiền của đơn hàng
  if (
    this.isNew ||
    this.isModified("orderItems") ||
    this.isModified("shippingPrice") ||
    this.isModified("discountAmount")
  ) {
    // Tính tổng tiền sản phẩm
    let calculatedSubTotal = 0;
    for (const item of this.orderItems) {
      calculatedSubTotal += item.price * item.quantity;
    }

    // Kiểm tra tổng tiền sản phẩm
    if (Math.abs(calculatedSubTotal - this.subTotal) > 0.01) {
      return next(
        new Error("Tổng tiền sản phẩm không khớp với giá trị tính toán")
      );
    }

    // Kiểm tra tổng tiền đơn hàng
    const calculatedTotal =
      calculatedSubTotal + this.shippingPrice - this.discountAmount;
    if (Math.abs(calculatedTotal - this.totalAmount) > 0.01) {
      return next(
        new Error("Tổng tiền đơn hàng không khớp với giá trị tính toán")
      );
    }
  }

  next();
});

// Tính toán lợi nhuận tổng khi lưu đơn hàng
OrderSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("orderItems")) {
    let profit = 0;
    for (const item of this.orderItems) {
      profit += (item.price - item.costPrice) * item.quantity;
    }
    this.totalProfit = profit;
  }
  next();
});

// Cập nhật timestamp khi thay đổi trạng thái
OrderSchema.pre("save", function (next) {
  if (this.isModified("status")) {
    const now = new Date();
    switch (this.status) {
      case "confirmed":
        this.confirmedAt = now;
        break;
      case "shipping":
        this.shippedAt = now;
        break;
      case "delivered":
        this.deliveredAt = now;
        break;
      case "cancelled":
        this.cancelledAt = now;
        break;
    }

    // Thêm vào lịch sử trạng thái nếu chưa có
    if (!this.statusHistory) {
      this.statusHistory = [];
    }

    this.statusHistory.push({
      status: this.status,
      date: now,
      description:
        this.status === "cancelled" ? this.cancellationReason : undefined,
      user: undefined, // Sẽ được cập nhật bởi controller
    });
  }
  next();
});

// Tự động tạo thông báo khi thay đổi trạng thái đơn hàng
OrderSchema.post("save", async function () {
  if (this.isModified("status")) {
    // Import model Notification theo cách này để tránh circular dependency
    const Notification = mongoose.model("Notification");

    let title = "";
    let message = "";

    switch (this.status) {
      case "confirmed":
        title = "Đơn hàng đã được xác nhận";
        message = `Đơn hàng #${this.orderCode} của bạn đã được xác nhận và đang chuẩn bị giao hàng.`;
        break;
      case "shipping":
        title = "Đơn hàng đang được giao";
        message = `Đơn hàng #${this.orderCode} của bạn đang được giao đến địa chỉ của bạn.`;
        break;
      case "delivered":
        title = "Đơn hàng đã giao thành công";
        message = `Đơn hàng #${this.orderCode} đã được giao thành công. Cảm ơn bạn đã mua hàng!`;
        break;
      case "cancelled":
        if (!this.cancellationReason) {
          title = "Đơn hàng đã bị hủy";
          message = `Đơn hàng #${this.orderCode} đã bị hủy.`;
        }
        break;
    }

    if (title && message) {
      try {
        await Notification.create({
          userId: this.user,
          title,
          message,
          type: "order",
          relatedId: this._id,
          onModel: "Order",
        });
      } catch (error) {
        console.error("Error creating notification:", error);
      }
    }
  }
});

// Thêm các index để cải thiện hiệu suất truy vấn
OrderSchema.index({ user: 1, createdAt: -1 }); // Tìm kiếm đơn hàng của người dùng
OrderSchema.index({ status: 1 }); // Lọc theo trạng thái
OrderSchema.index({ paymentStatus: 1 }); // Lọc theo trạng thái thanh toán

const Order = mongoose.model("Order", OrderSchema);

const validTransitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["delivered"], // Loại bỏ khả năng hủy đơn khi đang giao
  delivered: [], // Đơn hàng đã giao không thể chuyển sang trạng thái khác
  cancelled: [], // Đơn hàng đã hủy không thể khôi phục
};

// Cập nhật tồn kho khi thanh toán thành công
OrderSchema.methods.updateInventoryAfterPayment = async function (session) {
  const Product = mongoose.model("Product");

  // Lặp qua từng sản phẩm trong đơn hàng
  for (const orderItem of this.orderItems) {
    // Tìm sản phẩm
    const product = await Product.findById(orderItem.product);

    if (product) {
      // Tìm variant tương ứng
      const variant = product.variants.find(
        (v) => v._id.toString() === orderItem.variant.toString()
      );

      if (variant) {
        try {
          // Tìm size tương ứng
          const sizeItem = variant.sizes.find(
            (s) => s.size.toString() === orderItem.size.toString()
          );

          if (sizeItem) {
            // Cập nhật số lượng và trạng thái
            sizeItem.quantity -= orderItem.quantity;
            sizeItem.totalSoldSize += orderItem.quantity;
            product.totalSoldproduct += orderItem.quantity;

            if (sizeItem.quantity <= 0) {
              sizeItem.isSizeAvailable = false;
            }

            // Lưu sản phẩm, sử dụng session nếu có
            if (session) {
              await product.save({ session });
            } else {
              await product.save();
            }
          } else {
            console.warn(
              `Không tìm thấy kích thước ${orderItem.size} trong biến thể màu ${orderItem.color} cho sản phẩm ${product._id}`
            );
          }
        } catch (error) {
          console.error(`Lỗi khi cập nhật kho hàng: ${error.message}`);
          throw new Error(
            `Không thể cập nhật kho hàng cho sản phẩm ${product.name}: ${error.message}`
          );
        }
      } else {
        console.warn(
          `Không tìm thấy biến thể màu ${orderItem.color} cho sản phẩm ${product._id}`
        );
      }
    } else {
      console.warn(`Không tìm thấy sản phẩm với ID: ${orderItem.product}`);
    }
  }
};

module.exports = Order;
