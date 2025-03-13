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
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
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
          required: true,
          default: 1,
          min: 1,
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    active: {
      type: Boolean,
      default: true,
    },
    totalItems: {
      type: Number,
      default: 0,
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
        // Lấy thông tin sản phẩm với populate đầy đủ
        const product = await Product.findById(item.product)
          .populate("variants.color", "name hexCode")
          .populate("variants.sizes.size", "value");

        // Kiểm tra sản phẩm có tồn tại không
        if (!product) {
          invalidItems.push({
            item,
            reason: "Sản phẩm không tồn tại",
            statusCode: "PRODUCT_NOT_FOUND",
          });
          continue;
        }

        // Kiểm tra sản phẩm có đang hoạt động không
        if (!product.isActive || product.isDeleted) {
          invalidItems.push({
            item,
            reason: "Sản phẩm không còn hoạt động hoặc đã bị xóa",
            statusCode: "PRODUCT_UNAVAILABLE",
          });
          continue;
        }

        // Sử dụng phương thức findVariant từ Product model
        const variantInfo = product.findVariant(
          item.color.toString(),
          item.size.toString()
        );

        if (!variantInfo) {
          invalidItems.push({
            item,
            reason: "Biến thể sản phẩm không tồn tại",
            statusCode: "VARIANT_NOT_FOUND",
          });
          continue;
        }

        // Kiểm tra tính khả dụng của biến thể
        if (!variantInfo.isAvailable) {
          let reason = "Biến thể sản phẩm hiện không khả dụng";
          let statusCode = "VARIANT_UNAVAILABLE";

          // Cung cấp lý do chi tiết hơn
          if (variantInfo.status === "discontinued") {
            reason = "Sản phẩm tạm ngưng kinh doanh";
            statusCode = "VARIANT_DISCONTINUED";
          } else if (variantInfo.status === "inactive") {
            reason = "Biến thể sản phẩm không còn hoạt động";
            statusCode = "VARIANT_INACTIVE";
          } else if (
            !variantInfo.isSizeAvailable ||
            variantInfo.quantity <= 0
          ) {
            reason = "Kích thước này đã hết hàng";
            statusCode = "SIZE_OUT_OF_STOCK";
          }

          invalidItems.push({
            item,
            reason,
            statusCode,
            status: variantInfo.status,
          });
          continue;
        }

        // Kiểm tra số lượng
        if (variantInfo.quantity < item.quantity) {
          invalidItems.push({
            item,
            reason: "Không đủ số lượng trong kho",
            statusCode: "INSUFFICIENT_QUANTITY",
            availableQuantity: variantInfo.quantity,
          });
          continue;
        }
      } catch (error) {
        console.error(
          `Lỗi khi kiểm tra sản phẩm trong giỏ hàng: ${error.message}`
        );
        invalidItems.push({
          item,
          reason: `Lỗi khi kiểm tra: ${error.message}`,
          statusCode: "VALIDATION_ERROR",
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
      statusCode: "SYSTEM_ERROR",
    };
  }
};

const Cart = mongoose.model("Cart", CartSchema);

module.exports = Cart;
