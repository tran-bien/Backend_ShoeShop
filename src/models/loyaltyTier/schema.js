const mongoose = require("mongoose");

const LoyaltyTierSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    slug: {
      type: String,
      unique: true,
    },

    minPoints: {
      type: Number,
      required: true,
      min: 0,
    },

    maxPoints: {
      type: Number,
      min: 0,
    },

    benefits: {
      discountPercent: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
        comment: "% giảm giá cho hạng này",
      },

      pointsMultiplier: {
        type: Number,
        default: 1,
        min: 1,
        max: 5,
        comment: "Hệ số nhân điểm (x1, x1.5, x2...)",
      },

      freeShipping: {
        type: Boolean,
        default: false,
        comment: "Miễn phí ship",
      },

      prioritySupport: {
        type: Boolean,
        default: false,
        comment: "Hỗ trợ ưu tiên",
      },

      birthdayBonusPoints: {
        type: Number,
        default: 0,
        comment: "Điểm thưởng sinh nhật",
      },

      earlyAccess: {
        type: Boolean,
        default: false,
        comment: "Truy cập sớm sản phẩm mới",
      },
    },

    displayOrder: {
      type: Number,
      required: true,
      default: 0,
    },

    color: {
      type: String,
      default: "#808080",
      comment: "Màu hiển thị badge",
    },

    icon: {
      type: String,
      comment: "Icon/emoji cho tier",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index
LoyaltyTierSchema.index({ minPoints: 1 });
LoyaltyTierSchema.index({ displayOrder: 1 });

module.exports = LoyaltyTierSchema;

