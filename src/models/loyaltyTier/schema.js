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
      pointsMultiplier: {
        type: Number,
        default: 1,
        min: 1,
        max: 5,
        comment: "Hệ số nhân điểm (x1, x1.5, x2...)",
      },

      prioritySupport: {
        type: Boolean,
        default: false,
        comment: "Hỗ trợ ưu tiên",
      },
    },

    displayOrder: {
      type: Number,
      required: true,
      default: 0,
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
