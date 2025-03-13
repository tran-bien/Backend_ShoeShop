const mongoose = require("mongoose");

const CancelRequestSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    adminNote: {
      type: String,
    },
    resolvedAt: {
      type: Date,
    },
    // attachments: {
    //   type: [String],
    //   default: [],
    // },
  },
  {
    timestamps: true,
  }
);

// Cập nhật thời gian giải quyết khi thay đổi trạng thái
CancelRequestSchema.pre("save", function (next) {
  if (this.isModified("status") && this.status !== "pending") {
    this.resolvedAt = Date.now();
  }
  next();
});

const CancelRequest = mongoose.model("CancelRequest", CancelRequestSchema);

module.exports = CancelRequest;
