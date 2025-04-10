const mongoose = require("mongoose");

/**
 * Kiểm tra tồn kho của sản phẩm
 * @param {Object} cartItem - Mục giỏ hàng cần kiểm tra
 * @returns {Promise<{isAvailable: boolean, availableQuantity: number}>} - Kết quả kiểm tra
 */
const checkInventory = async (cartItem) => {
  try {
    const Variant = mongoose.model("Variant");
    const variant = await Variant.findById(cartItem.variant);

    if (!variant) {
      return { isAvailable: false, availableQuantity: 0 };
    }

    // Tìm size trong biến thể
    const sizeObj = variant.sizes.find(
      (s) => s.size && s.size.toString() === cartItem.size.toString()
    );

    if (!sizeObj || !sizeObj.isSizeAvailable) {
      return { isAvailable: false, availableQuantity: 0 };
    }

    return {
      isAvailable: sizeObj.quantity >= cartItem.quantity,
      availableQuantity: sizeObj.quantity,
    };
  } catch (error) {
    console.error(`[cart/middleware] Lỗi kiểm tra tồn kho: ${error.message}`);
    return { isAvailable: false, availableQuantity: 0 };
  }
};

/**
 * Tính toán giá trị giảm giá từ coupon
 * @param {Object} cart - Giỏ hàng
 * @returns {Promise<number>} - Giá trị giảm giá
 */
const calculateDiscount = async (cart) => {
  if (!cart.coupon) return 0;

  try {
    const Coupon = mongoose.model("Coupon");
    const coupon = await Coupon.findById(cart.coupon);

    if (!coupon || !coupon.isActive) return 0;

    // Kiểm tra thời hạn coupon
    const now = new Date();
    if (now < coupon.startDate || now > coupon.endDate) return 0;

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (cart.subTotal < coupon.minOrderAmount) return 0;

    // Tính giảm giá
    let discountAmount = 0;
    if (coupon.discountType === "percent") {
      discountAmount = (cart.subTotal * coupon.discountValue) / 100;
      // Áp dụng giới hạn giảm giá nếu có
      if (coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = coupon.discountValue;
    }

    // Cập nhật thông tin coupon lưu trong cart
    cart.couponData = {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxDiscountAmount: coupon.maxDiscountAmount,
    };

    return Math.min(discountAmount, cart.subTotal);
  } catch (error) {
    console.error(`[cart/middleware] Lỗi tính giảm giá: ${error.message}`);
    return 0;
  }
};

/**
 * Áp dụng middleware cho Cart Schema
 * @param {mongoose.Schema} schema - Schema để áp dụng middleware
 */
const applyMiddlewares = (schema) => {
  // Thêm thông tin sản phẩm khi thêm vào giỏ hàng
  schema.pre("save", async function (next) {
    try {
      // Chỉ xử lý khi cartItems thay đổi
      if (this.isModified("cartItems")) {
        const Product = mongoose.model("Product");
        const Variant = mongoose.model("Variant");
        const Size = mongoose.model("Size");

        // Cập nhật thông tin hiển thị cho từng mục giỏ hàng
        for (let i = 0; i < this.cartItems.length; i++) {
          const item = this.cartItems[i];

          // Chỉ cập nhật các mục mới hoặc đã thay đổi
          if (!item.productName || !item.variantName || !item.sizeName) {
            const [product, variant, size] = await Promise.all([
              Product.findById(item.product),
              Variant.findById(item.variant),
              Size.findById(item.size),
            ]);

            if (product) {
              this.cartItems[i].productName = product.name;
            }

            if (variant) {
              this.cartItems[i].variantName = variant.name;
              this.cartItems[i].price = variant.priceFinal || variant.price;

              // Lấy ảnh chính của biến thể
              if (variant.images && variant.images.length > 0) {
                this.cartItems[i].image = variant.images[0];
              } else if (
                product &&
                product.images &&
                product.images.length > 0
              ) {
                this.cartItems[i].image = product.images[0];
              }
            }

            if (size) {
              this.cartItems[i].sizeName = size.name || size.value || size;
            }

            // Kiểm tra tồn kho
            const inventoryStatus = await checkInventory(item);
            this.cartItems[i].isAvailable = inventoryStatus.isAvailable;

            // Nếu số lượng yêu cầu vượt quá tồn kho, giới hạn xuống
            if (
              !inventoryStatus.isAvailable &&
              inventoryStatus.availableQuantity > 0
            ) {
              this.cartItems[i].quantity = Math.min(
                this.cartItems[i].quantity,
                inventoryStatus.availableQuantity
              );
            }
          }
        }

        // Lọc bỏ các mục có số lượng tồn kho = 0
        this.cartItems = this.cartItems.filter((item) => item.quantity > 0);
      }

      next();
    } catch (error) {
      next(error);
    }
  });

  // Tính toán tổng giá trị giỏ hàng
  schema.pre("save", async function (next) {
    try {
      if (this.cartItems && Array.isArray(this.cartItems)) {
        // Tính subtotal
        this.subTotal = this.cartItems.reduce((total, item) => {
          return total + (item.price * item.quantity || 0);
        }, 0);

        // Tổng số lượng items
        this.totalItems = this.cartItems.reduce((count, item) => {
          return count + (item.quantity || 0);
        }, 0);

        // Tính giảm giá nếu có coupon
        if (this.coupon) {
          this.discount = await calculateDiscount(this);
        } else {
          this.discount = 0;
        }

        // Tính tổng tiền sau giảm giá
        this.totalPrice = Math.max(0, this.subTotal - this.discount);
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  // Xử lý khi findOneAndUpdate
  schema.pre("findOneAndUpdate", async function (next) {
    try {
      const update = this.getUpdate();
      const cartItems =
        update.cartItems || (update.$set && update.$set.cartItems);

      // Xử lý khi cập nhật cartItems
      if (cartItems && Array.isArray(cartItems)) {
        const Product = mongoose.model("Product");
        const Variant = mongoose.model("Variant");
        const Size = mongoose.model("Size");

        // Cập nhật thông tin và kiểm tra tồn kho
        for (let i = 0; i < cartItems.length; i++) {
          const item = cartItems[i];

          // Cập nhật thông tin hiển thị
          const [product, variant, size] = await Promise.all([
            Product.findById(item.product),
            Variant.findById(item.variant),
            Size.findById(item.size),
          ]);

          if (product) {
            cartItems[i].productName = product.name;
          }

          if (variant) {
            cartItems[i].variantName = variant.name;
            cartItems[i].price = variant.priceFinal || variant.price;

            // Lấy ảnh chính của biến thể
            if (variant.images && variant.images.length > 0) {
              cartItems[i].image = variant.images[0];
            } else if (product && product.images && product.images.length > 0) {
              cartItems[i].image = product.images[0];
            }
          }

          if (size) {
            cartItems[i].sizeName = size.name || size.value || size;
          }

          // Kiểm tra tồn kho
          const inventoryStatus = await checkInventory(item);
          cartItems[i].isAvailable = inventoryStatus.isAvailable;

          // Nếu số lượng yêu cầu vượt quá tồn kho, giới hạn xuống
          if (
            !inventoryStatus.isAvailable &&
            inventoryStatus.availableQuantity > 0
          ) {
            cartItems[i].quantity = Math.min(
              cartItems[i].quantity,
              inventoryStatus.availableQuantity
            );
          }
        }

        // Lọc bỏ các mục có số lượng tồn kho = 0
        const filteredItems = cartItems.filter((item) => item.quantity > 0);

        // Tính tổng giá trị
        const subTotal = filteredItems.reduce((total, item) => {
          return total + (item.price * item.quantity || 0);
        }, 0);

        const totalItems = filteredItems.reduce((count, item) => {
          return count + (item.quantity || 0);
        }, 0);

        // Cập nhật giỏ hàng
        if (!update.$set) update.$set = {};
        update.$set.cartItems = filteredItems;
        update.$set.subTotal = subTotal;
        update.$set.totalItems = totalItems;

        // Tính giảm giá nếu có coupon
        const doc = await this.model.findOne(this.getQuery());
        if (doc && doc.coupon) {
          update.$set.discount = await calculateDiscount({
            ...doc.toObject(),
            subTotal,
          });
          update.$set.totalPrice = Math.max(0, subTotal - update.$set.discount);
        } else {
          update.$set.discount = 0;
          update.$set.totalPrice = subTotal;
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  });
};

module.exports = {
  applyMiddlewares,
  checkInventory,
  calculateDiscount,
};
