const { Cart, Product, Variant, Size, Coupon } = require("@models");
const ApiError = require("@utils/ApiError");
const mongoose = require("mongoose");

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
        isSelected: true,
        hasCoupon: false,
        itemDiscount: 0,
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
      cart.cartItems[itemIndex].unavailableReason = `Chỉ còn ${sizeInfo.quantity} sản phẩm trong kho`;
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
   * Chọn hoặc bỏ chọn sản phẩm trong giỏ hàng
   * @param {String} userId - ID của người dùng
   * @param {Object} data - Dữ liệu chọn sản phẩm
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  toggleSelectCartItems: async (userId, data) => {
    const { itemIds, selected } = data;
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      throw new ApiError(400, "Danh sách sản phẩm không hợp lệ");
    }

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Cập nhật trạng thái chọn cho các sản phẩm
    let updatedCount = 0;
    itemIds.forEach(itemId => {
      const item = cart.cartItems.find(item => item._id.toString() === itemId);
      if (item) {
        item.isSelected = selected !== undefined ? selected : !item.isSelected;
        updatedCount++;
      }
    });

    if (updatedCount === 0) {
      throw new ApiError(404, "Không tìm thấy sản phẩm nào để cập nhật");
    }

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: `Đã ${selected ? 'chọn' : 'bỏ chọn'} ${updatedCount} sản phẩm`,
      cart,
    };
  },

  /**
   * Chuẩn bị thông tin checkout từ giỏ hàng chỉ lấy các sản phẩm đã chọn
   * @param {String} userId - ID của người dùng
   * @returns {Object} - Thông tin cần thiết cho checkout chỉ lấy các sản phẩm đã chọn
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

    // Lọc chỉ lấy các sản phẩm đã chọn
    const selectedItems = cart.cartItems.filter(item => item.isSelected && item.isAvailable);
    
    // Kiểm tra giỏ hàng có sản phẩm đã chọn không
    if (selectedItems.length === 0) {
      throw new ApiError(400, "Không có sản phẩm nào được chọn hoặc sẵn sàng để thanh toán");
    }

    // Kiểm tra tồn kho của từng sản phẩm
    for (const item of selectedItems) {
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

    // Tính tổng giá trị sản phẩm được chọn
    const subTotal = selectedItems.reduce(
      (total, item) => total + (item.price * item.quantity),
      0
    );
    
    // Tính tổng giảm giá từ các sản phẩm được chọn
    const discount = selectedItems.reduce(
      (total, item) => total + (item.hasCoupon ? item.itemDiscount : 0),
      0
    );

    // Thêm phí vận chuyển mặc định
    let shippingFee = 30000; // 30,000 VND

    // Miễn phí vận chuyển nếu có > 2 sản phẩm và subtotal >= 1,000,000
    let totalItems = selectedItems.reduce(
      (total, item) => total + item.quantity,
      0
    );
    if (totalItems > 2 && subTotal >= 1000000) {
      shippingFee = 0;
    }

    // Tính tổng tiền cuối cùng
    const totalAmount = subTotal - discount + shippingFee;

    return {
      success: true,
      checkoutInfo: {
        cartId: cart._id,
        cartItems: selectedItems,
        subTotal,
        discount,
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

  /**
   * Xóa sản phẩm khỏi giỏ hàng theo sản phẩm đã chọn trong giỏ hàng
   * @param {String} userId - ID của người dùng
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  removeCartItem: async (userId) => {
    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Tìm các mặt hàng đã chọn và có sẵn để xóa
    const itemsToRemove = cart.cartItems.filter(item => item.isSelected && item.isAvailable);

    if (itemsToRemove.length === 0) {
      throw new ApiError(404, "Không tìm thấy sản phẩm đã chọn trong giỏ hàng");
    }

    // Xóa các mặt hàng đã chọn khỏi giỏ hàng
    cart.cartItems = cart.cartItems.filter(item => !(item.isSelected && item.isAvailable));

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: `Đã xóa ${itemsToRemove.length} sản phẩm đã chọn khỏi giỏ hàng`,
      cart,
    };
  },

  /**
   * Xóa toàn bộ giỏ hàng
   * @param {String} userId - ID của người dùng
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
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

  /**
   * Áp dụng mã giảm giá cho các sản phẩm được chọn
   * @param {String} userId - ID của người dùng
   * @param {Object} data - Dữ liệu áp dụng coupon
   * @returns {Object} - Kết quả áp dụng coupon
   */
  applyCoupon: async (userId, data) => {
    const { couponCode, itemIds } = data;
    
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

    // Xác định các sản phẩm được áp dụng mã giảm giá
    let selectedItems = [];
    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      // Áp dụng cho các sản phẩm được chọn
      selectedItems = cart.cartItems.filter(item => 
        itemIds.includes(item._id.toString()) && item.isAvailable
      );
      
      if (selectedItems.length === 0) {
        throw new ApiError(400, "Không có sản phẩm hợp lệ nào được chọn");
      }
    } else {
      // Áp dụng cho tất cả sản phẩm có isSelected = true và isAvailable = true
      selectedItems = cart.cartItems.filter(item => item.isSelected && item.isAvailable);
      
      if (selectedItems.length === 0) {
        throw new ApiError(400, "Không có sản phẩm nào được chọn trong giỏ hàng");
      }
    }

    // Tính tổng giá trị của các sản phẩm được chọn
    const subtotalSelected = selectedItems.reduce(
      (total, item) => total + (item.price * item.quantity),
      0
    );

    // Tìm mã giảm giá
    const coupon = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
      $or: [
        { isPublic: true },
        { users: userId }
      ]
    });

    if (!coupon) {
      throw new ApiError(400, "Mã giảm giá không hợp lệ, đã hết hạn hoặc bạn chưa thu thập");
    }

    // Kiểm tra số lần sử dụng
    if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
      throw new ApiError(400, "Mã giảm giá đã hết lượt sử dụng");
    }

    // Kiểm tra giá trị đơn hàng tối thiểu
    if (coupon.minOrderValue && subtotalSelected < coupon.minOrderValue) {
      throw new ApiError(
        400,
        `Giá trị đơn hàng được chọn chưa đạt tối thiểu ${coupon.minOrderValue.toLocaleString()}đ để áp dụng mã giảm giá`
      );
    }

    // Kiểm tra applyFor nếu cần
    if (coupon.applyFor !== "all") {
      // Logic kiểm tra phạm vi áp dụng...
      // Truy vấn dữ liệu và kiểm tra từng sản phẩm được chọn
    }

    // Tính toán giảm giá tổng thể
    let totalDiscount = 0;
    if (coupon.type === "percent") {
      totalDiscount = (subtotalSelected * coupon.value) / 100;
      if (coupon.maxDiscount) {
        totalDiscount = Math.min(totalDiscount, coupon.maxDiscount);
      }
    } else { // fixed
      totalDiscount = Math.min(coupon.value, subtotalSelected);
    }

    // Phân bổ giảm giá cho từng sản phẩm theo tỷ lệ
    // Đặt lại tất cả hasCoupon và itemDiscount
    cart.cartItems.forEach(item => {
      item.hasCoupon = false;
      item.itemDiscount = 0;
    });
    
    // Cập nhật sản phẩm được chọn
    selectedItems.forEach(selectedItem => {
      const item = cart.cartItems.find(
        item => item._id.toString() === selectedItem._id.toString()
      );
      
      if (item) {
        const itemSubtotal = item.price * item.quantity;
        const ratio = itemSubtotal / subtotalSelected;
        item.hasCoupon = true;
        item.itemDiscount = Math.round(totalDiscount * ratio);
      }
    });

    // Áp dụng mã giảm giá
    cart.coupon = coupon._id;
    cart.couponData = {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      maxDiscount: coupon.maxDiscount
    };
    
    // Cập nhật tổng giảm giá và tổng tiền
    cart.discount = totalDiscount;
    cart.totalPrice = cart.subTotal - totalDiscount;

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã áp dụng mã giảm giá cho các sản phẩm được chọn",
      cart,
    };
  },

  /**
   * Hủy mã giảm giá cho các sản phẩm được chọn và có sẵn trong giỏ hàng
   * @param {String} userId - ID của người dùng
   * @param {Object} data - Dữ liệu hủy coupon (có thể có itemIds)
   * @returns {Object} - Kết quả hủy coupon
   */
  removeCoupon: async (userId, data = {}) => {
    const { itemIds } = data;

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Kiểm tra nếu giỏ hàng không có mã giảm giá
    if (!cart.coupon || !cart.couponData) {
      return {
        success: true,
        message: "Giỏ hàng không có mã giảm giá",
        cart,
      };
    }

    // Lọc các sản phẩm đã chọn, có sẵn và đang có coupon
    let itemsToRemoveCoupon;
    if (itemIds && Array.isArray(itemIds) && itemIds.length > 0) {
      itemsToRemoveCoupon = cart.cartItems.filter(item =>
        item.hasCoupon && item.isSelected && item.isAvailable &&
        itemIds.includes(item._id.toString())
      );
    } else {
      itemsToRemoveCoupon = cart.cartItems.filter(item =>
        item.hasCoupon && item.isSelected && item.isAvailable
      );
    }

    if (itemsToRemoveCoupon.length === 0) {
      return {
        success: true,
        message: "Không có sản phẩm đã chọn và sẵn sàng để hủy mã giảm giá",
        cart,
      };
    }

    // Tính tổng giảm giá bị hủy và cập nhật từng sản phẩm
    let totalDiscountRemoved = 0;
    itemsToRemoveCoupon.forEach(item => {
      totalDiscountRemoved += item.itemDiscount;
      item.hasCoupon = false;
      item.itemDiscount = 0;
    });

    // Cập nhật tổng giảm giá giỏ hàng
    cart.discount -= totalDiscountRemoved;

    // Nếu không còn sản phẩm nào có coupon, xóa coupon khỏi giỏ hàng
    const hasAnyCoupon = cart.cartItems.some(item => item.hasCoupon);
    if (!hasAnyCoupon) {
      cart.coupon = null;
      cart.couponData = null;
      cart.discount = 0;
    }

    // Cập nhật tổng giá
    cart.totalPrice = cart.subTotal - cart.discount;

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã hủy mã giảm giá cho các sản phẩm đã chọn và có sẵn trong giỏ hàng",
      cart,
    };
  },
};

module.exports = cartService;