const mongoose = require("mongoose");

const BlogCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 500,
    },

    slug: {
      type: String,
      unique: true,
    },

    description: {
      type: String,
      maxlength: 5000,
    },

    displayOrder: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

// Index
BlogCategorySchema.index({ slug: 1 });
BlogCategorySchema.index({ isActive: 1, deletedAt: 1 });

module.exports = BlogCategorySchema;

