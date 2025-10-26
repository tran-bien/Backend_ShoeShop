const mongoose = require("mongoose");

const BannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    image: {
      url: {
        type: String,
        required: true,
      },
      public_id: {
        type: String,
        required: true,
      },
    },
    displayOrder: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
      max: 5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    link: {
      type: String,
      trim: true,
      default: "",
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

// Index để đảm bảo displayOrder là unique trong số các banner active
BannerSchema.index(
  { displayOrder: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isActive: true,
      deletedAt: null,
    },
  }
);

module.exports = BannerSchema;
