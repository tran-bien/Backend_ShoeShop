const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    // Mã đơn hàng tự động sinh
    code: {
      type: String,
      unique: true,
    },

    // Thông tin người dùng
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Chi tiết các sản phẩm trong đơn hàng
    orderItems: [
      {
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
          required: true,
        },
        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
          required: true,
        },
        // Lưu tên sản phẩm để tránh reference khi sản phẩm thay đổi
        productName: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        // Lưu ảnh sản phẩm
        image: {
          type: String,
          default: "",
        },
      },
    ],

    // Thông tin địa chỉ giao hàng
    shippingAddress: {
      name: {
        type: String,
        required: true,
      },
      phone: {
        type: String,
        required: true,
        match: /^(0[2-9]|84[2-9])[0-9]{8}$/,
      },
      province: {
        type: String,
        required: true,
      },
      district: {
        type: String,
        required: true,
      },
      ward: {
        type: String,
        required: true,
      },
      detail: {
        type: String,
        required: true,
      },
    },

    // Ghi chú đơn hàng
    note: {
      type: String,
      default: "",
    },

    // Tổng tiền hàng (chưa tính giảm giá và phí ship)
    subTotal: {
      type: Number,
      required: true,
    },

    // Trạng thái đơn hàng
    status: {
      type: String,
      default: "pending",
      enum: {
        values: [
          "pending",
          "confirmed",
          "assigned_to_shipper",
          "out_for_delivery",
          "delivered",
          "delivery_failed",
          "returning_to_warehouse",
          "cancelled",
          "returned",
        ],
        message: "Trạng thái đơn hàng không hợp lệ",
      },
    },

    // Đánh dấu nếu là COD thì trừ hàng, VNPAY thì không trừ đợi thanh toán
    inventoryDeducted: {
      type: Boolean,
      default: false,
    },

    // Lịch sử trạng thái
    statusHistory: [
      {
        status: {
          type: String,
          enum: [
            "pending",
            "confirmed",
            "assigned_to_shipper",
            "out_for_delivery",
            "delivered",
            "delivery_failed",
            "returning_to_warehouse",
            "cancelled",
            "returned",
          ],
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        note: String,
      },
    ],

    // Thông tin thanh toán
    payment: {
      method: {
        type: String,
        required: true,
        enum: ["COD", "VNPAY"],
      },
      paymentStatus: {
        type: String,
        enum: {
          values: ["pending", "paid", "failed"],
          message: "Trạng thái thanh toán không hợp lệ",
        },
        default: "pending",
      },
      transactionId: {
        type: String,
        default: null,
      },
      paidAt: {
        type: Date,
        default: null,
      },
    },

    // Lịch sử thanh toán
    paymentHistory: [
      {
        status: {
          type: String,
          enum: ["pending", "paid", "failed"],
        },
        transactionId: String,
        amount: Number,
        method: String,
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        responseData: Object, // Dữ liệu phản hồi từ VNPAY
      },
    ],

    // Thông tin mã giảm giá
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
    },

    // Chi tiết mã giảm giá
    couponDetail: {
      code: String,
      type: {
        type: String,
        enum: ["percent", "fixed"],
      },
      value: Number,
      maxDiscount: Number,
    },

    // Phí ship
    shippingFee: {
      type: Number,
      default: 0,
    },

    // Giảm giá
    discount: {
      type: Number,
      default: 0,
    },

    // Tổng tiền sau khi tính giảm giá và phí ship
    totalAfterDiscountAndShipping: {
      type: Number,
      required: true,
    },

    // Tham chiếu đến yêu cầu hủy đơn
    cancelRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CancelRequest",
      default: null,
    },

    // Đánh dấu đơn hàng có yêu cầu hủy đang chờ xử lý
    hasCancelRequest: {
      type: Boolean,
      default: false,
    },

    // Lý do hủy đơn (từ yêu cầu hủy được duyệt)
    cancelReason: {
      type: String,
      default: "",
    },

    // Thời điểm đơn hàng bị hủy
    cancelledAt: {
      type: Date,
      default: null,
    },

    // Xác nhận hàng trả về (Manual confirmation for return/cancel)
    returnConfirmed: {
      type: Boolean,
      default: false,
    },
    returnConfirmedAt: {
      type: Date,
      default: null,
    },
    returnConfirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Thời gian giao hàng
    deliveredAt: {
      type: Date,
      default: null,
    },

    // Các mốc thời gian sự kiện
    confirmedAt: {
      type: Date,
      default: null,
    },
    shippingAt: {
      type: Date,
      default: null,
    },

    // Thông tin shipper
    assignedShipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignmentTime: {
      type: Date,
    },

    // Lịch sử giao hàng
    deliveryAttempts: [
      {
        time: {
          type: Date,
          default: Date.now,
        },
        status: {
          type: String,
          enum: ["success", "failed", "partial"],
        },
        location: {
          lat: Number,
          lng: Number,
        },
        note: String,
        shipper: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        images: [String],
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = OrderSchema;
