const mongoose = require("mongoose");

const returnRequestSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      comment: "Mã yêu cầu đổi/trả, VD: RET-001, EXC-001",
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["RETURN", "EXCHANGE"],
      required: true,
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
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
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        priceAtPurchase: {
          type: Number,
          required: true,
        },
        // Chỉ dành cho EXCHANGE
        exchangeToVariant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
        },
        exchangeToSize: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Size",
        },
      },
    ],
    reason: {
      type: String,
      enum: [
        "wrong_size",
        "wrong_product",
        "defective",
        "not_as_described",
        "changed_mind",
        "other",
      ],
      required: true,
    },
    reasonDetail: {
      type: String,
      trim: true,
    },
    images: [
      {
        type: String,
      },
    ],
    // Phương thức hoàn tiền (chỉ cho RETURN - TẤT CẢ ĐỀU THỦ CÔNG)
    // Không có tự động hoàn tiền qua VNPAY - Admin xử lý thủ công
    refundMethod: {
      type: String,
      enum: ["cash", "bank_transfer"],
      comment:
        "cash=Tiền mặt tại cửa hàng, bank_transfer=Chuyển khoản (cần bankInfo)",
    },
    refundAmount: {
      type: Number,
      min: 0,
    },
    // Thông tin chuyển khoản (nếu bank_transfer)
    // Khách nhập → Admin xem → Chuyển khoản thủ công → Đánh dấu completed
    bankInfo: {
      bankName: String,
      accountNumber: String,
      accountName: String,
    },

    // SHIPPING FEE HANDLING - Xử lý phí ship
    shippingFee: {
      customerPay: {
        type: Number,
        default: 0,
        min: 0,
        comment: "Phí ship khách hàng trả khi gửi hàng về",
      },
      refundShippingFee: {
        type: Boolean,
        default: false,
        comment: "Có hoàn lại phí ship ban đầu không (nếu lỗi shop)",
      },
      originalShippingFee: {
        type: Number,
        default: 0,
        min: 0,
        comment: "Phí ship ban đầu của đơn hàng",
      },
    },

    // PRICE DIFFERENCE - Chênh lệch giá khi đổi hàng
    priceDifference: {
      amount: {
        type: Number,
        default: 0,
        comment: "Số tiền chênh lệch (+ hoặc -)",
      },
      direction: {
        type: String,
        enum: ["customer_pay", "refund_to_customer", "equal"],
        default: "equal",
        comment: "Hướng thanh toán",
      },
      isPaid: {
        type: Boolean,
        default: false,
        comment: "Đã thanh toán chênh lệch chưa",
      },
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "processing",
        "completed",
        "rejected",
        "canceled",
      ],
      default: "pending",
    },

    // AUTO-REJECT - Tự động từ chối nếu quá hạn
    autoRejectedAt: Date,
    expiresAt: {
      type: Date,
      comment: "Hết hạn xử lý sau 7 ngày kể từ khi tạo",
    },
    // Tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    processedAt: Date,
    completedAt: Date,
    rejectionReason: String,
    staffNotes: String,
  },
  {
    timestamps: true,
  }
);

// Index
returnRequestSchema.index({ order: 1 });
returnRequestSchema.index({ customer: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ expiresAt: 1, status: 1 }); // For auto-reject cronjob
// ADDED: Compound index để optimize duplicate exchange request check
returnRequestSchema.index({
  order: 1,
  type: 1,
  status: 1,
  "items.variant": 1,
  "items.size": 1,
});

// Apply middleware (auto-generate code, expiresAt, email notifications, loyalty points)
const applyReturnRequestMiddleware = require("./middlewares");
applyReturnRequestMiddleware(returnRequestSchema);

module.exports = returnRequestSchema;
