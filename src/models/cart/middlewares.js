const mongoose = require("mongoose");
const cartSchema = require("./schema");
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
 * Tính tổng số lượng sản phẩm trong giỏ hàng
 * @param {Array} cartItems - Danh sách sản phẩm trong giỏ hàng
 * @returns {Number} - Tổng số lượng
 */
const calculateTotalItems = (cartItems) => {
  return cartItems.reduce((total, item) => total + item.quantity, 0);
};

/**
 * Tính tổng giá trị sản phẩm trong giỏ hàng
 * @param {Array} cartItems - Danh sách sản phẩm trong giỏ hàng
 * @returns {Number} - Tổng giá trị
 */
const calculateSubTotal = (cartItems) => {
  return cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );
};

/**
 * Kiểm tra và xác thực coupon
 * @param {Object} coupon - Thông tin coupon
 * @param {Number} subTotal - Tổng giá trị đơn hàng
 * @returns {Object} - Kết quả kiểm tra và giá trị giảm giá
 */
const validateCoupon = async (coupon, subTotal) => {
  if (!coupon) return { isValid: false, discount: 0 };

  // Kiểm tra ngày hết hạn
  if (!coupon.isActive) {
    return {
      isValid: false,
      message: "Mã giảm giá không hoạt động",
      discount: 0,
    };
  }

  const now = new Date();
  if (now < coupon.startDate || now > coupon.endDate) {
    return {
      isValid: false,
      message: "Mã giảm giá đã hết hạn hoặc chưa đến thời gian sử dụng",
      discount: 0,
    };
  }

  // Kiểm tra đơn hàng tối thiểu
  if (coupon.minOrderValue && subTotal < coupon.minOrderValue) {
    return {
      isValid: false,
      message: `Giá trị đơn hàng tối thiểu để sử dụng mã giảm giá này là ${coupon.minOrderValue.toLocaleString(
        "vi-VN"
      )}đ`,
      discount: 0,
    };
  }

  // Tính giá trị giảm giá
  let discount = 0;
  if (coupon.type === "percent") {
    discount = (subTotal * coupon.value) / 100;
    if (coupon.maxDiscount) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  } else {
    discount = Math.min(coupon.value, subTotal);
  }

  return {
    isValid: true,
    discount,
  };
};

/**
 * Cập nhật thông tin của một mục trong giỏ hàng
 * @param {Object} cartItem - Mục cần cập nhật
 * @returns {Object} - Dữ liệu đã cập nhật
 */
const updateCartItemInfo = async (cartItem) => {
  // Lấy thông tin sản phẩm
  const Product = mongoose.model("Product");
  const Variant = mongoose.model("Variant");
  const Size = mongoose.model("Size");

  // Kiểm tra sản phẩm có tồn tại không
  const product = await Product.findById(cartItem.product);
  if (!product || !product.isActive) {
    cartItem.isAvailable = false;
    cartItem.unavailableReason = "Sản phẩm không tồn tại hoặc đã bị ẩn";
    return cartItem;
  }

  // Kiểm tra biến thể có tồn tại không
  const variant = await Variant.findById(cartItem.variant);
  if (!variant || !variant.isActive) {
    cartItem.isAvailable = false;
    cartItem.unavailableReason = "Biến thể không tồn tại hoặc đã bị ẩn";
    return cartItem;
  }

  // Kiểm tra kích cỡ có tồn tại không
  const size = await Size.findById(cartItem.size);
  if (!size) {
    cartItem.isAvailable = false;
    cartItem.unavailableReason = "Kích cỡ không tồn tại";
    return cartItem;
  }

  // Kiểm tra trong variant có size này không
  const sizeInVariant = variant.sizes.find(
    (s) => s.size.toString() === cartItem.size.toString()
  );

  if (!sizeInVariant || !sizeInVariant.isSizeAvailable) {
    cartItem.isAvailable = false;
    cartItem.unavailableReason = "Kích cỡ này hiện không có sẵn";
    return cartItem;
  }

  // Kiểm tra tồn kho đủ không
  if (sizeInVariant.quantity < cartItem.quantity) {
    cartItem.isAvailable = false;
    cartItem.unavailableReason = `Chỉ còn ${sizeInVariant.quantity} sản phẩm trong kho`;
    return cartItem;
  }

  // Cập nhật thông tin về sản phẩm
  cartItem.productName = product.name;
  cartItem.variantName = variant.name;
  cartItem.sizeName = size.name || size.value;
  cartItem.price = variant.priceFinal || variant.price;
  cartItem.image = variant.images?.[0] || product.images?.[0];
  cartItem.isAvailable = true;
  cartItem.unavailableReason = "";

  return cartItem;
};

/**
 * Áp dụng middleware cho schema giỏ hàng
 */
const applyMiddlewares = () => {
  // Trước khi lưu giỏ hàng
  cartSchema.pre("save", async function (next) {
    try {
      // Nếu không có sự thay đổi trong items hoặc coupon, không cần cập nhật giá
      if (!this.isModified("cartItems") && !this.isModified("coupon")) {
        return next();
      }

      // Cập nhật thông tin về sản phẩm, giá, tên,...
      if (this.cartItems.length > 0) {
        for (let i = 0; i < this.cartItems.length; i++) {
          this.cartItems[i] = await updateCartItemInfo(this.cartItems[i]);
        }
      }

      // Tính toán tổng số lượng và tổng giá
      this.totalItems = calculateTotalItems(this.cartItems);
      this.subTotal = calculateSubTotal(this.cartItems);

      // Xử lý coupon nếu có
      if (this.coupon) {
        const Coupon = mongoose.model("Coupon");
        const coupon = await Coupon.findById(this.coupon);

        const validationResult = await validateCoupon(coupon, this.subTotal);

        if (validationResult.isValid) {
          this.discount = validationResult.discount;
          this.couponData = {
            code: coupon.code,
            type: coupon.type,
            value: coupon.value,
            maxDiscount: coupon.maxDiscount,
          };
        } else {
          // Nếu coupon không hợp lệ, xóa coupon
          this.coupon = null;
          this.couponData = null;
          this.discount = 0;
          this.couponError = validationResult.message;
        }
      } else {
        this.discount = 0;
        this.couponData = null;
        this.couponError = null;
      }

      // Tính toán giá cuối cùng
      this.totalPrice = this.subTotal - (this.discount || 0);

      return next();
    } catch (error) {
      return next(error);
    }
  });

  // Hook để kiểm tra khi cart được truy vấn
  cartSchema.post("findOne", async function (doc, next) {
    if (!doc) return next();

    try {
      let needUpdate = false;

      // Kiểm tra và cập nhật thông tin sản phẩm
      if (doc.cartItems.length > 0) {
        for (let i = 0; i < doc.cartItems.length; i++) {
          const updatedItem = await updateCartItemInfo(doc.cartItems[i]);
          // Kiểm tra nếu có thay đổi
          if (
            updatedItem.price !== doc.cartItems[i].price ||
            updatedItem.isAvailable !== doc.cartItems[i].isAvailable ||
            updatedItem.productName !== doc.cartItems[i].productName ||
            updatedItem.variantName !== doc.cartItems[i].variantName ||
            updatedItem.sizeName !== doc.cartItems[i].sizeName
          ) {
            doc.cartItems[i] = updatedItem;
            needUpdate = true;
          }
        }
      }

      // Cập nhật giỏ hàng nếu có thay đổi
      if (needUpdate) {
        doc.totalItems = calculateTotalItems(doc.cartItems);
        doc.subTotal = calculateSubTotal(doc.cartItems);

        // Kiểm tra lại coupon nếu có
        if (doc.coupon) {
          const Coupon = mongoose.model("Coupon");
          const coupon = await Coupon.findById(doc.coupon);

          const validationResult = await validateCoupon(coupon, doc.subTotal);

          if (validationResult.isValid) {
            doc.discount = validationResult.discount;
          } else {
            doc.coupon = null;
            doc.couponData = null;
            doc.discount = 0;
            doc.couponError = validationResult.message;
          }
        } else {
          doc.discount = 0;
        }

        // Cập nhật tổng giá
        doc.totalPrice = doc.subTotal - (doc.discount || 0);
        await doc.save();
      }

      return next();
    } catch (error) {
      return next(error);
    }
  });
};

module.exports = { applyMiddlewares };
