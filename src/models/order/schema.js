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
        size: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
          required: [true, "ID kích thước là bắt buộc"],
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
        type: String,
        default: null,
      },
      paidAt: {
        type: Date,
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

module.exports = OrderSchema;
