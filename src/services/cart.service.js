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
        subTotal: 0
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

    try {
      // Kiểm tra biến thể và kích thước có tồn tại không
      const Variant = mongoose.model("Variant");
      const Size = mongoose.model("Size");
      const Product = mongoose.model("Product");
      
      // Lấy thông tin biến thể
      const variant = await Variant.findById(variantId);
      
      if (!variant) {
        throw new ApiError(404, "Không tìm thấy biến thể sản phẩm");
      }
      
      if (variant.isActive === false) {
        throw new ApiError(400, "Biến thể sản phẩm đang không được kích hoạt");
      }
      
      // Lấy thông tin sản phẩm trực tiếp từ database
      const productId = variant.product;
      const product = await Product.findById(productId);
      
      if (!product) {
        throw new ApiError(404, "Không tìm thấy sản phẩm");
      }
      
      if (product.isActive === false || product.deletedAt !== null) {
        throw new ApiError(400, "Sản phẩm đang không được kích hoạt hoặc đã bị xóa");
      }

      // Kiểm tra kích thước
      const size = await Size.findById(sizeId);
      if (!size) {
        throw new ApiError(404, "Không tìm thấy kích thước sản phẩm");
      }

      // Kiểm tra tồn kho
      const sizeInfo = variant.sizes.find(
        (s) => s.size && s.size.toString() === sizeId.toString()
      );
      
      if (!sizeInfo) {
        throw new ApiError(400, "Sản phẩm không có kích thước này");
      }
      
      if (!sizeInfo.isSizeAvailable) {
        throw new ApiError(400, "Kích thước này hiện không có sẵn");
      }
      
      if (sizeInfo.quantity < quantity) {
        throw new ApiError(400, `Sản phẩm đã hết hàng hoặc không đủ số lượng. Hiện chỉ còn ${sizeInfo.quantity} sản phẩm.`);
      }

      // Lấy giỏ hàng của người dùng, tạo mới nếu chưa có
      const Cart = mongoose.model("Cart");
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

      // Lấy hình ảnh từ biến thể hoặc sản phẩm
      let imageUrl = "";
      if (variant.imagesvariant && variant.imagesvariant.length > 0) {
        const mainImage = variant.imagesvariant.find(img => img.isMain);
        imageUrl = mainImage ? mainImage.url : variant.imagesvariant[0].url;
      } else if (product.images && product.images.length > 0) {
        const mainImage = product.images.find(img => img.isMain);
        imageUrl = mainImage ? mainImage.url : product.images[0].url;
      }

      if (existingItemIndex > -1) {
        // Nếu sản phẩm đã có trong giỏ hàng, cập nhật số lượng
        cart.cartItems[existingItemIndex].quantity += quantity;

        // Kiểm tra số lượng không vượt quá tồn kho
        if (cart.cartItems[existingItemIndex].quantity > sizeInfo.quantity) {
          cart.cartItems[existingItemIndex].quantity = sizeInfo.quantity;
        }
        
        // Cập nhật các thông tin khác nếu cần
        cart.cartItems[existingItemIndex].isAvailable = true;
        cart.cartItems[existingItemIndex].image = imageUrl;
        cart.cartItems[existingItemIndex].price = variant.priceFinal || variant.price;
        cart.cartItems[existingItemIndex].productName = product.name;
        cart.cartItems[existingItemIndex].unavailableReason = "";
      } else {
        // Nếu sản phẩm chưa có trong giỏ hàng, thêm mới
        cart.cartItems.push({
          variant: variantId,
          size: sizeId,
          quantity: Math.min(quantity, sizeInfo.quantity),
          price: variant.priceFinal || variant.price,
          productName: product.name,
          image: imageUrl,
          isAvailable: true,
          isSelected: false,
          unavailableReason: "",
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
    } catch (error) {
      if (error.stack) console.error(error.stack);
      throw error;
    }
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
   * Chuyển đổi trạng thái chọn sản phẩm trong giỏ hàng (toggle)
   * @param {String} userId - ID của người dùng
   * @param {String} itemId - ID của sản phẩm
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  toggleSelectCartItem: async (userId, itemId) => {
    
    if (!itemId) {
      throw new ApiError(400, "ID sản phẩm không hợp lệ");
    }

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Tìm sản phẩm trong giỏ hàng
    const item = cart.cartItems.find(item => item._id.toString() === itemId);
    
    if (!item) {
      throw new ApiError(404, "Không tìm thấy sản phẩm trong giỏ hàng");
    }

    // Toggle trạng thái isSelected
    item.isSelected = !item.isSelected;

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: `Đã ${item.isSelected ? 'chọn' : 'bỏ chọn'} sản phẩm`,
      cart,
    };
  },

  /**
   * Xem trước kết quả áp dụng mã giảm giá và tính toán phí vận chuyển (không lưu vào DB)
   * @param {String} userId - ID của người dùng
   * @param {Object} data - Dữ liệu áp dụng coupon
   * @returns {Object} - Kết quả tính toán
   */
  previewCoupon: async (userId, data) => {
    const { couponCode } = data;
    
    // Kiểm tra dữ liệu đầu vào coupon
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

    // Lọc các sản phẩm đã chọn và có sẵn
    const selectedItems = cart.cartItems.filter(item => item.isSelected && item.isAvailable);
    if (selectedItems.length === 0) {
      throw new ApiError(400, "Không có sản phẩm nào được chọn trong giỏ hàng");
    }

    // Tính tổng giá trị của các sản phẩm được chọn
    const subtotalSelected = selectedItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    // Tính phí vận chuyển
    const DEFAULT_SHIPPING_FEE = 30000;
    const SHIPPING_FREE_THRESHOLD = 1000000;
    const shippingFee = subtotalSelected >= SHIPPING_FREE_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;

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

    const totalAfterDiscount = subtotalSelected - totalDiscount;

    // Tạo dữ liệu xem trước (không lưu vào DB)
    const previewData = {
      original: {
        subTotal: subtotalSelected,
        shippingFee,
        totalPrice: subtotalSelected + shippingFee
      },
      withCoupon: {
        couponCode: coupon.code,
        couponType: coupon.type,
        couponValue: coupon.value,
        maxDiscount: coupon.maxDiscount || null,
        discount: totalDiscount,
        totalAfterDiscount,
        shippingFee,
        totalPrice: totalAfterDiscount + shippingFee
      }
    };

    return {
      success: true,
      message: "Dự tính giảm giá và phí vận chuyển khi áp dụng mã",
      preview: previewData
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
    cart.totalItems = 0;
    cart.subTotal = 0;

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: "Đã xóa toàn bộ giỏ hàng",
      cart,
    };
  },
};

module.exports = cartService;