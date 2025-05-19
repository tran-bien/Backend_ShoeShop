const { Cart, Product, Variant, Size, Coupon } = require("@models");
const ApiError = require("@utils/ApiError");

const cartService = {
  /**
   * Lấy giỏ hàng của người dùng, tạo mới nếu chưa có
   * @param {String} userId - ID của người dùng
   * @returns {Object} - Giỏ hàng của người dùng
   */
  getCartByUser: async (userId) => {
    let cart = await Cart.findOne({ user: userId });

    // Nếu chưa có giỏ hàng, tạo mới
    if (!cart) {
      cart = new Cart({
        user: userId,
        cartItems: [],
        totalItems: 0,
        subTotal: 0,
        discount: 0,
        totalPrice: 0,
      });
      await cart.save();
    }

    return {
      success: true,
      cart,
    };
  },

  /**
   * Thêm sản phẩm vào giỏ hàng
   * @param {String} userId - ID của người dùng
   * @param {Object} itemData - Dữ liệu mặt hàng
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  addToCart: async (userId, itemData) => {
    const { variantId, sizeId, quantity = 1 } = itemData;

    // Kiểm tra dữ liệu đầu vào
    if (!variantId || !sizeId) {
      throw new ApiError(400, "Thông tin sản phẩm không đủ");
    }

    // Kiểm tra biến thể và kích thước có tồn tại không
    const variant = await Variant.findById(variantId).populate("product");
    const size = await Size.findById(sizeId);

    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể sản phẩm");
    }

    if (!variant.product) {
      throw new ApiError(404, "Không tìm thấy sản phẩm");
    }

    if (!size) {
      throw new ApiError(404, "Không tìm thấy kích thước sản phẩm");
    }

    // Kiểm tra tồn kho
    const sizeInfo = variant.sizes.find(
      (s) => s.size.toString() === sizeId.toString()
    );
    if (
      !sizeInfo ||
      !sizeInfo.isSizeAvailable ||
      sizeInfo.quantity < quantity
    ) {
      throw new ApiError(400, "Sản phẩm đã hết hàng hoặc không đủ số lượng");
    }

    // Lấy giỏ hàng của người dùng, tạo mới nếu chưa có
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({
        user: userId,
        cartItems: [],
      });
    }

    // Kiểm tra sản phẩm đã có trong giỏ hàng chưa
    const existingItemIndex = cart.cartItems.findIndex(
      (item) =>
        item.variant.toString() === variantId &&
        item.size.toString() === sizeId
    );

    if (existingItemIndex > -1) {
      // Nếu sản phẩm đã có trong giỏ hàng, cập nhật số lượng
      cart.cartItems[existingItemIndex].quantity += quantity;

      // Kiểm tra số lượng không vượt quá tồn kho
      if (cart.cartItems[existingItemIndex].quantity > sizeInfo.quantity) {
        cart.cartItems[existingItemIndex].quantity = sizeInfo.quantity;
      }
    } else {
      // Nếu sản phẩm chưa có trong giỏ hàng, thêm mới
      cart.cartItems.push({
        variant: variantId,
        size: sizeId,
        quantity: Math.min(quantity, sizeInfo.quantity),
        price: variant.priceFinal || variant.price,
        productName: variant.product.name,
        image: variant.imagesvariant?.find(img => img.isMain)?.url || 
               variant.product.images?.find(img => img.isMain)?.url || "",
        isAvailable: true,
        addedAt: new Date(),
      });
    }

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã thêm sản phẩm vào giỏ hàng",
      cart,
    };
  },

  /**
   * Cập nhật số lượng sản phẩm trong giỏ hàng
   * @param {String} userId - ID của người dùng
   * @param {String} itemId - ID của mặt hàng
   * @param {Number} quantity - Số lượng mới
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  updateCartItem: async (userId, itemId, quantity) => {
    // Kiểm tra dữ liệu đầu vào
    if (!itemId || !quantity || quantity < 1) {
      throw new ApiError(400, "Thông tin cập nhật không hợp lệ");
    }

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Tìm mặt hàng trong giỏ hàng
    const itemIndex = cart.cartItems.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      throw new ApiError(404, "Không tìm thấy sản phẩm trong giỏ hàng");
    }

    // Lấy thông tin sản phẩm để kiểm tra tồn kho
    const cartItem = cart.cartItems[itemIndex];
    const variant = await Variant.findById(cartItem.variant);

    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể sản phẩm");
    }

    // Kiểm tra tồn kho
    const sizeInfo = variant.sizes.find(
      (s) => s.size.toString() === cartItem.size.toString()
    );

    if (!sizeInfo || !sizeInfo.isSizeAvailable) {
      throw new ApiError(400, "Sản phẩm đã hết hàng");
    }

    // Cập nhật số lượng và không cho vượt quá tồn kho
    cart.cartItems[itemIndex].quantity = Math.min(quantity, sizeInfo.quantity);

    // Nếu tồn kho không đủ, thông báo
    if (quantity > sizeInfo.quantity) {
      cart.cartItems[itemIndex].isAvailable = false;
    }

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã cập nhật số lượng sản phẩm",
      cart,
    };
  },

  /**
   * Chuẩn bị thông tin checkout từ giỏ hàng
   * @param {String} userId - ID của người dùng
   * @returns {Object} - Thông tin cần thiết cho checkout
   */
  prepareCheckout: async (userId) => {
    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId })
      .populate({
        path: "cartItems.variant",
        select: "price priceFinal product",
        populate: {
          path: "product",
          select: "name slug"
        }
      })
      .populate("cartItems.size", "value description");

    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Kiểm tra giỏ hàng có sản phẩm không
    if (cart.cartItems.length === 0) {
      throw new ApiError(400, "Giỏ hàng trống, không thể checkout");
    }

    // Kiểm tra tồn kho của từng sản phẩm
    for (const item of cart.cartItems) {
      const variant = await Variant.findById(item.variant);
      if (!variant) {
        throw new ApiError(404, `Không tìm thấy biến thể sản phẩm`);
      }

      const sizeInfo = variant.sizes.find(
        (s) => s.size.toString() === item.size.toString()
      );

      if (
        !sizeInfo ||
        !sizeInfo.isSizeAvailable ||
        sizeInfo.quantity < item.quantity
      ) {
        throw new ApiError(
          400,
          `Sản phẩm "${item.productName} (kích thước: ${item.size.value})" đã hết hàng hoặc không đủ số lượng`
        );
      }
    }

    // Thêm phí vận chuyển mặc định
    let shippingFee = 30000; // 30,000 VND

    // Miễn phí vận chuyển nếu có > 2 sản phẩm và subtotal >= 1,000,000
    let totalItems = cart.cartItems.reduce(
      (total, item) => total + item.quantity,
      0
    );
    if (totalItems > 2 && cart.subTotal >= 1000000) {
      shippingFee = 0;
    }

    // Tính tổng tiền cuối cùng
    const totalAmount = cart.subTotal - (cart.discount || 0) + shippingFee;

    return {
      success: true,
      checkoutInfo: {
        cartId: cart._id,
        cartItems: cart.cartItems,
        subTotal: cart.subTotal,
        discount: cart.discount || 0,
        coupon: cart.couponData || null,
        shippingFee,
        totalAmount,
        // Thông tin thanh toán
        paymentMethods: [
          { id: "COD", name: "Thanh toán khi nhận hàng" },
          { id: "VNPAY", name: "Thanh toán qua VNPAY" },
        ],
      },
    };
  },

  // Các phương thức khác (removeCartItem, clearCart, applyCoupon, removeCoupon) giữ nguyên
  removeCartItem: async (userId, itemId) => {
    // Kiểm tra dữ liệu đầu vào
    if (!itemId) {
      throw new ApiError(400, "Không có ID sản phẩm");
    }

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Tìm mặt hàng trong giỏ hàng
    const itemIndex = cart.cartItems.findIndex(
      (item) => item._id.toString() === itemId
    );

    if (itemIndex === -1) {
      throw new ApiError(404, "Không tìm thấy sản phẩm trong giỏ hàng");
    }

    // Xóa mặt hàng khỏi giỏ hàng
    cart.cartItems.splice(itemIndex, 1);

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã xóa sản phẩm khỏi giỏ hàng",
      cart,
    };
  },

  clearCart: async (userId) => {
    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Xóa toàn bộ mặt hàng
    cart.cartItems = [];
    cart.coupon = null;
    cart.couponData = null;
    cart.totalItems = 0;
    cart.subTotal = 0;
    cart.discount = 0;
    cart.totalPrice = 0;

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã xóa toàn bộ giỏ hàng",
      cart,
    };
  },

  applyCoupon: async (userId, couponCode) => {
    // Kiểm tra dữ liệu đầu vào
    if (!couponCode) {
      throw new ApiError(400, "Vui lòng nhập mã giảm giá");
    }

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Kiểm tra giỏ hàng có sản phẩm không
    if (cart.cartItems.length === 0) {
      throw new ApiError(400, "Giỏ hàng trống, không thể áp dụng mã giảm giá");
    }

    // Tìm mã giảm giá
    const coupon = await Coupon.findOne({
      code: couponCode,
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    if (!coupon) {
      throw new ApiError(400, "Mã giảm giá không hợp lệ hoặc đã hết hạn");
    }

    // Kiểm tra số lần sử dụng
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      throw new ApiError(400, "Mã giảm giá đã hết lượt sử dụng");
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (coupon.minOrderAmount && cart.subTotal < coupon.minOrderAmount) {
      throw new ApiError(
        400,
        `Giá trị đơn hàng chưa đạt tối thiểu ${coupon.minOrderAmount.toLocaleString()}đ để áp dụng mã giảm giá`
      );
    }

    // Áp dụng mã giảm giá
    cart.coupon = coupon._id;

    // Lưu giỏ hàng - các tính toán cập nhật discount sẽ được xử lý bởi middleware
    await cart.save();

    return {
      success: true,
      message: "Đã áp dụng mã giảm giá",
      cart,
    };
  },

  removeCoupon: async (userId) => {
    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Xóa mã giảm giá
    cart.coupon = null;
    cart.couponData = null;
    cart.discount = 0;
    cart.totalPrice = cart.subTotal;

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã hủy mã giảm giá",
      cart,
    };
  },
};

module.exports = cartService;