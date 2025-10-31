const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    dateOfBirth: {
      type: Date,
    },
    role: {
      type: String,
      enum: ["user", "staff", "admin", "shipper"],
      default: "user",
    },
    avatar: {
      url: {
        type: String,
        default: "",
      },
      public_id: {
        type: String,
        default: "",
      },
    },
    wishlist: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    coupons: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
      },
    ],
    addresses: [
      {
        fullName: { type: String, required: true },
        phone: { type: String, required: true },
        province: { type: String, required: true },
        district: { type: String, required: true },
        ward: { type: String, required: true },
        addressDetail: { type: String, required: true },
        isDefault: { type: Boolean, default: false },
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    blockReason: {
      type: String,
    },
    blockedAt: {
      type: Date,
    },
    otp: {
      code: { type: String },
      expiredAt: { type: Date },
    },
    resetPasswordToken: { type: String },
    resetPasswordExpire: { type: Date },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Thông tin shipper
    shipper: {
      isAvailable: {
        type: Boolean,
        default: false,
      },
      activeOrders: {
        type: Number,
        default: 0,
      },
      maxOrders: {
        type: Number,
        default: 5,
      },
      deliveryStats: {
        total: {
          type: Number,
          default: 0,
        },
        successful: {
          type: Number,
          default: 0,
        },
        failed: {
          type: Number,
          default: 0,
        },
      },
    },

    // Hệ thống tích điểm & phân hạng
    loyalty: {
      points: {
        type: Number,
        default: 0,
        min: 0,
      },
      tier: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LoyaltyTier",
      },
      tierName: {
        type: String,
        default: "Đồng",
      },
      totalEarned: {
        type: Number,
        default: 0,
        comment: "Tổng điểm đã tích lũy từ trước đến nay",
      },
      totalRedeemed: {
        type: Number,
        default: 0,
        comment: "Tổng điểm đã sử dụng",
      },
      lastTierUpdate: {
        type: Date,
      },
    },

    // Tùy chọn thông báo
    preferences: {
      emailNotifications: {
        orderUpdates: {
          type: Boolean,
          default: true,
          comment:
            "Nhận email khi đơn hàng có thay đổi (xác nhận, đang giao, đã giao, hủy, đổi hàng, trả hàng)",
        },
        newsletter: {
          type: Boolean,
          default: false,
          comment: "Nhận bản tin, tin tức mới",
        },
      },
      inAppNotifications: {
        type: Boolean,
        default: true,
        comment: "Nhận thông báo trong app",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = UserSchema;
