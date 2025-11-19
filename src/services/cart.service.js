const {
  Cart,
  Product,
  Variant,
  Size,
  Coupon,
  InventoryItem,
} = require("@models");
const ApiError = require("@utils/ApiError");
const mongoose = require("mongoose");

const cartService = {
  getCartByUser: async (userId) => {
    // Tìm giỏ hàng của người dùng
    let cart = await Cart.findOne({ user: userId });

    // Nếu chưa có giỏ hàng, tạo mới
    if (!cart) {
      cart = new Cart({
        user: userId,
        cartItems: [],
        totalItems: 0,
        subTotal: 0,
      });
      await cart.save();
      return { success: true, cart };
    }

    // Kiểm tra và cập nhật trạng thái các sản phẩm
    const Variant = mongoose.model("Variant");
    for (let i = 0; i < cart.cartItems.length; i++) {
      const item = cart.cartItems[i];

      // Lấy ID thực của variant và size
      const variantId =
        typeof item.variant === "object" ? item.variant._id : item.variant;
      const sizeId = typeof item.size === "object" ? item.size._id : item.size;

      // Kiểm tra variant exists
      const variant = await Variant.findById(variantId).select("product");
      if (!variant) {
        item.isAvailable = false;
        item.unavailableReason = "Không tìm thấy biến thể sản phẩm";
        continue;
      }

      // Kiểm tra size exists trong variant
      const Variant2 = await Variant.findById(variantId).select("sizes");
      const sizeExists = Variant2.sizes.some(
        (s) => s.size && s.size.toString() === sizeId.toString()
      );

      if (!sizeExists) {
        item.isAvailable = false;
        item.unavailableReason = "Kích thước không có sẵn";
        continue;
      }

      // Kiểm tra tồn kho từ InventoryItem
      const inventoryItem = await InventoryItem.findOne({
        product: variant.product,
        variant: variantId,
        size: sizeId,
      });

      if (!inventoryItem || inventoryItem.quantity < item.quantity) {
        item.isAvailable = false;
        item.unavailableReason = !inventoryItem
          ? "Sản phẩm hiện không có sẵn"
          : inventoryItem.quantity === 0
          ? "Sản phẩm đã hết hàng"
          : `Chỉ còn ${inventoryItem.quantity} sản phẩm trong kho`;
      } else {
        item.isAvailable = true;
        item.unavailableReason = "";
      }
    }

    // Cập nhật trạng thái sản phẩm trong DB
    await cart.save();

    // FIXED: Populate và filter inactive/deleted products
    await cart.populate({
      path: "cartItems.variant",
      select: "color product gender imagesvariant isActive deletedAt",
      match: { isActive: true, deletedAt: null }, // Chỉ lấy variant active và chưa xóa
      populate: [
        { path: "color", select: "name code" },
        {
          path: "product",
          select: "_id name slug isActive deletedAt",
          match: { isActive: true, deletedAt: null }, // Chỉ lấy product active và chưa xóa
        },
      ],
    });

    await cart.populate({
      path: "cartItems.size",
      select: "value description",
    });

    // FIXED Bug #3: Loại bỏ items có variant/product bị xóa hoặc inactive
    const validItems = [];
    const invalidItems = [];

    for (const item of cart.cartItems) {
      // Nếu variant hoặc product null (do match condition không thỏa)
      if (!item.variant || !item.variant.product) {
        invalidItems.push({
          itemId: item._id,
          reason: "Sản phẩm không còn tồn tại hoặc đã bị vô hiệu hóa",
        });
        item.isAvailable = false;
        item.unavailableReason =
          "Sản phẩm không còn tồn tại hoặc đã bị vô hiệu hóa";
      } else {
        validItems.push(item);
      }
    }

    // Auto cleanup: Xóa items không hợp lệ khỏi cart
    if (invalidItems.length > 0) {
      cart.cartItems = cart.cartItems.filter(
        (item) => item.variant && item.variant.product
      );
      await cart.save();
      console.log(
        `[CART CLEANUP] Removed ${invalidItems.length} invalid items from cart ${cart._id}`
      );
    }

    // Nếu có items bị xóa/inactive, log thông tin
    if (invalidItems.length > 0) {
      console.log(
        `[CART CLEANUP] Tìm thấy ${invalidItems.length} item(s) với sản phẩm inactive/deleted:`,
        invalidItems
      );

      // Auto-remove các items không hợp lệ khỏi giỏ hàng
      cart.cartItems = cart.cartItems.filter(
        (item) => item.variant && item.variant.product
      );
      await cart.save();
    }

    return {
      success: true,
      cart,
      warnings:
        invalidItems.length > 0
          ? {
              removedItems: invalidItems,
              message: `Đã loại bỏ ${invalidItems.length} sản phẩm không còn khả dụng khỏi giỏ hàng`,
            }
          : null,
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
        throw new ApiError(422, "Biến thể sản phẩm đang không được kích hoạt");
      }

      // Lấy thông tin sản phẩm trực tiếp từ database
      const productId = variant.product;
      const product = await Product.findById(productId);

      if (!product) {
        throw new ApiError(404, "Không tìm thấy sản phẩm");
      }

      if (product.isActive === false || product.deletedAt !== null) {
        throw new ApiError(
          400,
          "Sản phẩm đang không được kích hoạt hoặc đã bị xóa"
        );
      }

      // Kiểm tra kích thước
      const size = await Size.findById(sizeId);
      if (!size) {
        throw new ApiError(404, "Không tìm thấy kích thước sản phẩm");
      }

      // Kiểm tra size có trong variant không
      const sizeExists = variant.sizes.some(
        (s) => s.size && s.size.toString() === sizeId.toString()
      );

      if (!sizeExists) {
        throw new ApiError(422, "Sản phẩm không có kích thước này");
      }

      // Kiểm tra tồn kho từ InventoryItem
      const inventoryItem = await InventoryItem.findOne({
        product: productId,
        variant: variantId,
        size: sizeId,
      });

      if (!inventoryItem) {
        throw new ApiError(422, "Sản phẩm hiện không có sẵn trong kho");
      }

      if (inventoryItem.quantity < quantity) {
        throw new ApiError(
          400,
          `Sản phẩm đã hết hàng hoặc không đủ số lượng. Hiện chỉ còn ${inventoryItem.quantity} sản phẩm.`
        );
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
        const mainImage = variant.imagesvariant.find((img) => img.isMain);
        imageUrl = mainImage ? mainImage.url : variant.imagesvariant[0].url;
      } else if (product.images && product.images.length > 0) {
        const mainImage = product.images.find((img) => img.isMain);
        imageUrl = mainImage ? mainImage.url : product.images[0].url;
      }

      // Lấy giá từ InventoryItem (finalPrice đã tính discount)
      const price = inventoryItem.finalPrice || inventoryItem.sellingPrice || 0;

      if (existingItemIndex > -1) {
        // Nếu sản phẩm đã có trong giỏ hàng, cập nhật số lượng
        cart.cartItems[existingItemIndex].quantity += quantity;

        // Kiểm tra số lượng không vượt quá tồn kho
        if (
          cart.cartItems[existingItemIndex].quantity > inventoryItem.quantity
        ) {
          cart.cartItems[existingItemIndex].quantity = inventoryItem.quantity;
        }

        // Cập nhật các thông tin khác nếu cần
        cart.cartItems[existingItemIndex].isAvailable = true;
        cart.cartItems[existingItemIndex].image = imageUrl;
        cart.cartItems[existingItemIndex].price = price;
        cart.cartItems[existingItemIndex].productName = product.name;
        cart.cartItems[existingItemIndex].unavailableReason = "";
      } else {
        // Nếu sản phẩm chưa có trong giỏ hàng, thêm mới
        cart.cartItems.push({
          variant: variantId,
          size: sizeId,
          quantity: Math.min(quantity, inventoryItem.quantity),
          price: price,
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

    // Sử dụng projection để chỉ lấy dữ liệu cần thiết
    const cart = await Cart.findOne(
      { user: userId },
      { cartItems: 1 } // Chỉ lấy cartItems, không lấy các trường khác
    );

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

    // Lấy variantId và sizeId từ cartItem
    const cartItem = cart.cartItems[itemIndex];

    // Lấy thông tin variant để tìm productId
    const variant = await Variant.findById(cartItem.variant).select(
      "product sizes"
    );

    if (!variant) {
      throw new ApiError(404, "Không tìm thấy biến thể sản phẩm");
    }

    // Kiểm tra size có trong variant không
    const sizeExists = variant.sizes.some(
      (s) => s.size.toString() === cartItem.size.toString()
    );

    if (!sizeExists) {
      throw new ApiError(422, "Sản phẩm không có kích thước này");
    }

    // Kiểm tra tồn kho từ InventoryItem
    const inventoryItem = await InventoryItem.findOne({
      product: variant.product,
      variant: cartItem.variant,
      size: cartItem.size,
    });

    if (!inventoryItem) {
      throw new ApiError(422, "Sản phẩm hiện không có sẵn trong kho");
    }

    // Cập nhật số lượng và kiểm tra tồn kho
    let exceededInventory = false;
    let updatedQuantity = quantity;

    if (quantity > inventoryItem.quantity) {
      exceededInventory = true;
      updatedQuantity = inventoryItem.quantity;
    }

    // Sử dụng updateOne thay vì save() để cập nhật trực tiếp
    await Cart.updateOne(
      {
        user: userId,
        "cartItems._id": itemId,
      },
      {
        $set: {
          "cartItems.$.quantity": updatedQuantity,
          "cartItems.$.isAvailable":
            exceededInventory && inventoryItem.quantity === 0 ? false : true,
          "cartItems.$.unavailableReason": exceededInventory
            ? inventoryItem.quantity === 0
              ? "Sản phẩm đã hết hàng"
              : `Chỉ còn ${inventoryItem.quantity} sản phẩm trong kho`
            : "",
          "cartItems.$.updatedAt": new Date(),
        },
      }
    );

    // Chỉ lấy thông tin cần thiết cho response
    const updatedCart = await Cart.findOne(
      { user: userId },
      { cartItems: { $elemMatch: { _id: itemId } } }
    );

    return {
      success: true,
      message: exceededInventory
        ? `Số lượng yêu cầu (${quantity}) vượt quá tồn kho, đã điều chỉnh về tối đa ${inventoryItem.quantity} sản phẩm`
        : "Đã cập nhật số lượng sản phẩm",
      updatedItem: updatedCart.cartItems[0],
      productInfo: {
        variant: cartItem.variant,
        size: cartItem.size,
        requestedQuantity: quantity,
        adjustedQuantity: updatedQuantity,
        exceededInventory,
        availableQuantity: inventoryItem.quantity,
      },
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
    const item = cart.cartItems.find((item) => item._id.toString() === itemId);

    if (!item) {
      throw new ApiError(404, "Không tìm thấy sản phẩm trong giỏ hàng");
    }

    // Toggle trạng thái isSelected
    item.isSelected = !item.isSelected;

    // Lưu giỏ hàng
    await cart.save();

    return {
      success: true,
      message: `Đã ${item.isSelected ? "chọn" : "bỏ chọn"} sản phẩm`,
      cart,
    };
  },

  /**
   * Xem trước kết quả tính toán đơn hàng bao gồm phí vận chuyển và giảm giá (nếu có)
   * @param {String} userId - ID của người dùng
   * @param {Object} data - Dữ liệu để tính toán (có thể có couponCode hoặc không)
   * @returns {Object} - Kết quả tính toán đơn hàng
   */
  previewBeforeOrder: async (userId, data = {}) => {
    const { couponCode } = data;

    // Lấy giỏ hàng của người dùng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new ApiError(404, "Không tìm thấy giỏ hàng");
    }

    // Lọc các sản phẩm đã chọn và có sẵn
    const selectedItems = cart.cartItems.filter(
      (item) => item.isSelected && item.isAvailable
    );

    // Tính tổng giá trị của các sản phẩm được chọn
    const subtotalSelected = selectedItems.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    // Tính phí vận chuyển
    const DEFAULT_SHIPPING_FEE = 30000;
    const SHIPPING_FREE_THRESHOLD = 1000000;
    const shippingFee =
      subtotalSelected >= SHIPPING_FREE_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;

    // Khởi tạo kết quả mặc định (không có mã giảm giá)
    const result = {
      success: true,
      preview: {
        items: selectedItems.length,
        itemsDetail: await Promise.all(
          selectedItems.map(async (item) => {
            const mongoose = require("mongoose");
            const Variant = mongoose.model("Variant");
            const Size = mongoose.model("Size");

            // Fetch variant details including product reference and color name
            const variantDoc = await Variant.findById(item.variant)
              .populate("product", "_id")
              .populate("color", "name");

            // Fetch size details to get the size value
            const sizeDoc = await Size.findById(item.size, "value description");

            return {
              productId: variantDoc?.product?._id || null,
              productName: item.productName,
              variantId: variantDoc?._id || item.variant,
              color: (await mongoose
                .model("Color")
                .findById(variantDoc.color, "name type code")
                .lean()) || { name: null, type: null, code: null },
              sizeId: sizeDoc?._id || item.size,
              sizeValue: sizeDoc?.value || null,
              sizeDescription: sizeDoc?.description || null,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
              totalPrice: item.price * item.quantity,
            };
          })
        ),
        totalQuantity: selectedItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
        subTotal: subtotalSelected,
        discount: 0,
        shippingFee,
        totalPrice: subtotalSelected + shippingFee,
        couponApplied: false,
      },
    };

    // Nếu không có mã giảm giá, trả về kết quả mặc định
    if (!couponCode) {
      return {
        success: true,
        message: "Dự tính đơn hàng (không có mã giảm giá)",
        preview: result.preview,
      };
    }

    // Xử lý trường hợp có mã giảm giá
    try {
      // Tìm mã giảm giá
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        status: "active",
        startDate: { $lte: new Date() },
        endDate: { $gte: new Date() },
        $or: [{ isPublic: true }, { users: userId }],
      });

      if (!coupon) {
        return {
          success: false,
          message:
            "Mã giảm giá không hợp lệ, đã hết hạn hoặc bạn chưa thu thập",
          preview: result.preview,
        };
      }

      // Kiểm tra số lần sử dụng
      if (coupon.maxUses && coupon.currentUses >= coupon.maxUses) {
        return {
          success: false,
          message: "Mã giảm giá đã hết lượt sử dụng",
          preview: result.preview,
        };
      }

      // Kiểm tra giá trị đơn hàng tối thiểu
      if (coupon.minOrderValue && subtotalSelected < coupon.minOrderValue) {
        return {
          success: false,
          message: `Giá trị đơn hàng được chọn chưa đạt tối thiểu ${coupon.minOrderValue.toLocaleString()}đ để áp dụng mã giảm giá`,
          preview: result.preview,
        };
      }

      // Tính toán giảm giá tổng thể
      let totalDiscount = 0;
      if (coupon.type === "percent") {
        totalDiscount = (subtotalSelected * coupon.value) / 100;
        if (coupon.maxDiscount) {
          totalDiscount = Math.min(totalDiscount, coupon.maxDiscount);
        }
      } else {
        // fixed
        totalDiscount = Math.min(coupon.value, subtotalSelected);
      }

      const totalAfterDiscount = subtotalSelected - totalDiscount;

      // Tạo kết quả với mã giảm giá
      const previewWithCoupon = {
        items: selectedItems.length,
        itemsDetail: await Promise.all(
          selectedItems.map(async (item) => {
            const mongoose = require("mongoose");
            const Variant = mongoose.model("Variant");
            const Size = mongoose.model("Size");

            // Fetch variant details including product reference and color name
            const variantDoc = await Variant.findById(item.variant)
              .populate("product", "_id")
              .populate("color", "name");

            // Fetch size details to get the size value
            const sizeDoc = await Size.findById(item.size, "value description");

            return {
              productId: variantDoc?.product?._id || null,
              productName: item.productName,
              variantId: variantDoc?._id || item.variant,
              color: (await mongoose
                .model("Color")
                .findById(variantDoc.color, "name type code")
                .lean()) || { name: null, type: null, code: null },
              sizeId: sizeDoc?._id || item.size,
              sizeValue: sizeDoc?.value || null,
              sizeDescription: sizeDoc?.description || null,
              price: item.price,
              quantity: item.quantity,
              image: item.image,
              totalPrice: item.price * item.quantity,
            };
          })
        ),
        totalQuantity: selectedItems.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
        subTotal: subtotalSelected,
        discount: totalDiscount,
        shippingFee,
        totalPrice: totalAfterDiscount + shippingFee,
        couponApplied: true,
        couponDetail: {
          code: coupon.code,
          type: coupon.type,
          value: coupon.value,
          maxDiscount: coupon.maxDiscount || null,
        },
      };

      return {
        success: true,
        message: "Dự tính đơn hàng với mã giảm giá",
        preview: previewWithCoupon,
      };
    } catch (error) {
      console.error("Lỗi khi tính toán với mã giảm giá:", error);
      // Nếu có lỗi khi xử lý mã giảm giá, vẫn trả về kết quả mặc định
      return {
        success: false,
        message: "Có lỗi xảy ra khi áp dụng mã giảm giá: " + error.message,
        preview: result.preview,
      };
    }
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
    const itemsToRemove = cart.cartItems.filter(
      (item) => item.isSelected && item.isAvailable
    );

    if (itemsToRemove.length === 0) {
      throw new ApiError(404, "Không tìm thấy sản phẩm đã chọn trong giỏ hàng");
    }

    // Xóa các mặt hàng đã chọn khỏi giỏ hàng
    cart.cartItems = cart.cartItems.filter(
      (item) => !(item.isSelected && item.isAvailable)
    );

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
