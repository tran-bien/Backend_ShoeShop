const mongoose = require("mongoose");

/**
 * ReturnRequest Schema - CHỈ HỖ TRỢ TRẢ HÀNG/HOÀN TIỀN
 * - Trả toàn bộ đơn hàng (không chọn từng sản phẩm)
 * - Phí trả hàng: 30.000đ (khách trả)
 * - Hoàn tiền qua: cash (shipper thu) hoặc bank_transfer
 */
const returnRequestSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      unique: true,
      comment: "Mã yêu cầu trả hàng, VD: RET-001",
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

    // Lý do trả hàng
    reason: {
      type: String,
      enum: [
        "wrong_size", // Sai kích cỡ
        "wrong_product", // Sai sản phẩm (giao nhầm)
        "defective", // Sản phẩm lỗi/hư hỏng
        "not_as_described", // Không giống mô tả
        "changed_mind", // Đổi ý (không muốn nữa)
        "other", // Lý do khác
      ],
      required: true,
    },
    reasonDetail: {
      type: String,
      trim: true,
      comment: "Chi tiết lý do (tùy chọn)",
    },

    // Phương thức hoàn tiền
    refundMethod: {
      type: String,
      enum: ["cash", "bank_transfer"],
      required: true,
      comment:
        "cash=Shipper thu tiền mặt hoàn cho khách, bank_transfer=Chuyển khoản",
    },

    // Số tiền hoàn (tổng đơn hàng - phí ship trả hàng 30k)
    refundAmount: {
      type: Number,
      min: 0,
      required: true,
    },

    // Thông tin chuyển khoản (nếu bank_transfer)
    bankInfo: {
      bankName: String,
      accountNumber: String,
      accountName: String,
    },

    // PHÍ TRẢ HÀNG - Mặc định 30.000đ
    returnShippingFee: {
      type: Number,
      default: 30000,
      comment: "Phí ship trả hàng, khách hàng trả",
    },

    // SHIPPER THU TIỀN HOÀN (nếu refundMethod = cash)
    refundCollectedByShipper: {
      collected: {
        type: Boolean,
        default: false,
        comment: "Shipper đã giao tiền hoàn cho khách chưa",
      },
      collectedAt: Date,
      shipperId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      note: String,
    },

    status: {
      type: String,
      enum: [
        "pending", // Chờ duyệt
        "approved", // Đã duyệt - chờ gán shipper
        "shipping", // Shipper đang lấy hàng
        "received", // Đã nhận hàng về kho
        "refunded", // Đã hoàn tiền
        "completed", // Hoàn tất
        "rejected", // Từ chối
        "canceled", // Khách hủy
      ],
      default: "pending",
    },

    // Tracking
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    approvedAt: Date,

    // Shipper được gán lấy hàng trả
    assignedShipper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    assignedAt: Date,

    // Khi shipper lấy được hàng về kho
    receivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receivedAt: Date,

    // Hoàn tất
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    completedAt: Date,

    rejectionReason: String,
    staffNotes: String,

    // AUTO-REJECT - Tự động từ chối nếu quá hạn
    autoRejectedAt: Date,
    expiresAt: {
      type: Date,
      comment: "Hết hạn xử lý sau 7 ngày kể từ khi tạo",
    },
  },
  {
    timestamps: true,
  }
);

// Index
returnRequestSchema.index({ order: 1 });
returnRequestSchema.index({ customer: 1, createdAt: -1 });
returnRequestSchema.index({ status: 1, createdAt: -1 });
returnRequestSchema.index({ assignedShipper: 1, status: 1 });
returnRequestSchema.index({ expiresAt: 1, status: 1 }); // For auto-reject

// Apply middleware (auto-generate code, expiresAt, email notifications, loyalty points)
const applyReturnRequestMiddleware = require("./middlewares");
applyReturnRequestMiddleware(returnRequestSchema);

module.exports = returnRequestSchema;
