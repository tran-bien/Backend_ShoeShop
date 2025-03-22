const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    shippingAddress: {
      name: {
        type: String,
        required: [true, "Tên người nhận hàng là bắt buộc"],
      },
      phone: {
        type: String,
        required: [true, "Số điện thoại người nhận hàng là bắt buộc"],
        match: [/^[0-9]{10}$/, "Số điện thoại không hợp lệ"],
      },
      province: {
        type: String,
        required: [true, "Vui lòng nhập tỉnh/thành phố"],
      },
      district: {
        type: String,
        required: [true, "Vui lòng nhập quận/huyện"],
      },
      ward: {
        type: String,
        required: [true, "Vui lòng nhập phường/xã"],
      },
      detail: {
        type: String,
        required: [true, "Vui lòng nhập địa chỉ chi tiết"],
      },
    },
    note: {
      type: String,
      default: "",
    },
    subTotal: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      default: "pending",
      enum: {
        values: ["pending", "confirmed", "shipping", "delivered", "cancelled"],
        message: "Trạng thái đơn hàng không hợp lệ",
      },
    },
    payment: {
      method: {
        type: String,
        required: [true, "Phương thức thanh toán là bắt buộc"],
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
        type: String, // ID giao dịch từ cổng thanh toán
        default: null,
      },
      paidAt: {
        type: Date, // Thời điểm thanh toán
        default: null,
      },
    },
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coupon",
    },
    shippingFee: {
      type: Number,
      default: 0,
    },
    discount: {
      type: Number,
      default: 0,
    },
    totalAfterDiscountAndShipping: {
      type: Number,
      required: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

OrderSchema.index({ code: 1 });
OrderSchema.index({ user: 1, deletedAt: 1 });
OrderSchema.index({ status: 1, deletedAt: 1 });
OrderSchema.index({ "payment.paymentStatus": 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ deletedAt: 1 });

module.exports = OrderSchema;
