const mongoose = require("mongoose");

const RecommendationCacheSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    algorithm: {
      type: String,
      enum: ["COLLABORATIVE", "CONTENT_BASED", "TRENDING", "HYBRID"],
      required: true,
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],

    scores: [Number],

    generatedAt: {
      type: Date,
      default: Date.now,
    },

    // TTL - Cache 24h
    expiresAt: {
      type: Date,
      required: true,
      expires: 0, // TTL index
    },
  },
  {
    timestamps: false,
  }
);

// Compound index
RecommendationCacheSchema.index({ user: 1, algorithm: 1 });
RecommendationCacheSchema.index({ expiresAt: 1 }); // TTL

module.exports = RecommendationCacheSchema;

