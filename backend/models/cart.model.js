const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    cartItems: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
          min: 1,
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
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Tự động cập nhật tổng số mặt hàng khi lưu
CartSchema.pre("save", function (next) {
  if (this.isModified("cartItems")) {
    this.totalItems = this.cartItems.length;
  }
  next();
});

// Phương thức kiểm tra tính hợp lệ của giỏ hàng
CartSchema.methods.validateItems = async function () {
  try {
    const Product = mongoose.model("Product");

    const invalidItems = [];

    for (const item of this.cartItems) {
      try {
        const product = await Product.findById(item.product);

        if (!product || !product.isActive || product.isDeleted) {
          invalidItems.push({
            item,
            reason: "Sản phẩm không tồn tại hoặc không còn hoạt động",
          });
          continue;
        }

        // Tìm biến thể tương ứng
        const variant = product.findVariant(item.color, item.size);

        if (!variant) {
          invalidItems.push({
            item,
            reason: "Biến thể sản phẩm không tồn tại",
          });
          continue;
        }

        if (!variant.isAvailable || variant.status !== "active") {
          invalidItems.push({
            item,
            reason: "Biến thể sản phẩm hiện không khả dụng",
          });
          continue;
        }

        if (variant.quantity < item.quantity) {
          invalidItems.push({
            item,
            reason: "Không đủ số lượng trong kho",
            availableQuantity: variant.quantity,
          });
        }
      } catch (error) {
        console.error(
          `Lỗi khi kiểm tra sản phẩm trong giỏ hàng: ${error.message}`
        );
        invalidItems.push({
          item,
          reason: `Lỗi khi kiểm tra: ${error.message}`,
        });
      }
    }

    return {
      isValid: invalidItems.length === 0,
      invalidItems,
    };
  } catch (error) {
    console.error(`Lỗi khi validate giỏ hàng: ${error.message}`);
    return {
      isValid: false,
      error: error.message,
    };
  }
};

const Cart = mongoose.model("Cart", CartSchema);

module.exports = Cart;
