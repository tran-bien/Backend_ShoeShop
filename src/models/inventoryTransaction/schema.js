const mongoose = require("mongoose");

const inventoryTransactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["IN", "OUT", "ADJUST"],
      required: true,
    },
    inventoryItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryItem",
      required: true,
    },
    // Số lượng
    quantityBefore: {
      type: Number,
      required: true,
    },
    quantityChange: {
      type: Number,
      required: true,
    },
    quantityAfter: {
      type: Number,
      required: true,
    },
    // Giá trị
    costPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
    },
    // Tính giá bán (chỉ cho IN transactions)
    targetProfitPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    percentDiscount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    calculatedPrice: {
      type: Number,
      min: 0,
    },
    calculatedPriceFinal: {
      type: Number,
      min: 0,
    },
    profitPerItem: {
      type: Number,
    },
    margin: {
      type: Number,
    },
    markup: {
      type: Number,
    },
    // Tham chiếu
    reason: {
      type: String,
      enum: [
        "initial_stock",
        "restock",
        "sale",
        "return",
        "exchange",
        "damage",
        "adjustment",
        "other",
      ],
      required: true,
    },
    reference: {
      type: {
        type: String,
        enum: ["Order", "ReturnRequest", "Manual"],
      },
      id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "reference.type",
      },
    },
    // Người thực hiện
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index
inventoryTransactionSchema.index({ inventoryItem: 1, createdAt: -1 });
inventoryTransactionSchema.index({ type: 1, createdAt: -1 });
inventoryTransactionSchema.index({ "reference.type": 1, "reference.id": 1 });

module.exports = inventoryTransactionSchema;
