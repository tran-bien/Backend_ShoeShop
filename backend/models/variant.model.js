const mongoose = require("mongoose");

const ProductImageSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  public_id: {
    type: String,
    required: true,
  },
  isMain: {
    type: Boolean,
    default: false,
  },
  displayOrder: {
    type: Number,
    default: 0,
  },
});

// Định nghĩa schema cho biến thể sản phẩm
const VariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    imagesvariant: [ProductImageSchema],
    price: {
      type: Number,
      required: [true, "Giá bán biến thể là bắt buộc"],
    },
    costPrice: {
      type: Number,
      required: [true, "Vui lòng nhập giá gốc biến thể"],
      min: [0, "Giá gốc biến thể không được âm"],
      validate: {
        validator: function (value) {
          return value >= 0 && Number.isFinite(value);
        },
        message: "Giá gốc biến thể phải là số hợp lệ và không âm",
      },
    },
    percentDiscount: {
      type: Number,
      default: 0, // phần trăm giảm giá
    },
    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
      required: true,
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Color",
      required: true,
    },
    size: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Size",
      required: true,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSold: {
      type: Number,
      default: 0,
      min: [0, "Tổng số lượng đã bán không được âm"],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "discontinued"],
      default: "active",
    },
    sku: {
      type: String,
      required: true,
      unique: true,
    },
    lastRestocked: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Middleware trước khi validate
VariantSchema.pre("validate", function (next) {
  // Tự động cập nhật isAvailable dựa trên quantity và status
  this.isAvailable = this.quantity > 0 && this.status === "active";
  next();
});

// Indexes để tăng tốc truy vấn
VariantSchema.index(
  { product: 1, color: 1, size: 1, gender: 1 },
  { unique: true }
);
VariantSchema.index({ status: 1 });
VariantSchema.index({ isAvailable: 1 });

const Variant = mongoose.model("Variant", VariantSchema);

module.exports = Variant;
