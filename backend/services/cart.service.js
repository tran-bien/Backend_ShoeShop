const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

const cartService = {
  /**
   * Lấy thông tin giỏ hàng của người dùng
   * @param {String} userId - ID người dùng
   * @returns {Object} - Thông tin giỏ hàng
   */
  getCart: async (userId) => {
    // Tìm giỏ hàng hiện tại của người dùng hoặc tạo mới nếu chưa có
    let cart = await Cart.findOne({ user: userId })
      .populate({
        path: "items.product",
        select: "name price discount thumbnail images isActive stockStatus",
      })
      .populate({
        path: "items.variant",
        select: "priceFinal price color sizes",
      })
      .populate({
        path: "items.color",
        select: "name hexCode",
      })
      .populate({
        path: "items.size",
        select: "value",
      });

    // Nếu không tìm thấy giỏ hàng, tạo mới
    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
      });
    }

    // Cập nhật giỏ hàng nếu có sản phẩm không hợp lệ hoặc hết hàng
    let needsUpdate = false;
    const updatedItems = [];

    for (const item of cart.items) {
      if (
        !item.product ||
        !item.product.isActive ||
        item.product.stockStatus === "outOfStock"
      ) {
        needsUpdate = true;
        continue;
      }

      // Kiểm tra biến thể còn hàng không
      const variant = await Product.findOne(
        {
          _id: item.product._id,
          variants: {
            $elemMatch: {
              color: item.color._id,
              sizes: {
                $elemMatch: {
                  size: item.size._id,
                  quantity: { $gte: item.quantity },
                  isSizeAvailable: true,
                },
              },
            },
          },
        },
        { "variants.$": 1 }
      );

      if (!variant) {
        // Nếu không có đủ số lượng, điều chỉnh số lượng trong giỏ hàng
        const availableVariant = await Product.findOne(
          {
            _id: item.product._id,
            variants: {
              $elemMatch: {
                color: item.color._id,
                sizes: {
                  $elemMatch: {
                    size: item.size._id,
                    isSizeAvailable: true,
                  },
                },
              },
            },
          },
          { "variants.$": 1 }
        );

        if (availableVariant) {
          const sizeInfo = availableVariant.variants[0].sizes.find(
            (s) => s.size.toString() === item.size._id.toString()
          );
          if (sizeInfo && sizeInfo.quantity > 0) {
            item.quantity = Math.min(item.quantity, sizeInfo.quantity);
            needsUpdate = true;
            updatedItems.push(item);
          } else {
            needsUpdate = true;
            continue;
          }
        } else {
          needsUpdate = true;
          continue;
        }
      } else {
        updatedItems.push(item);
      }
    }

    // Cập nhật giỏ hàng nếu có thay đổi
    if (needsUpdate) {
      cart.items = updatedItems;
      const { totalQuantity, totalAmount } = calculateCartTotal(cart.items);
      cart.totalQuantity = totalQuantity;
      cart.totalAmount = totalAmount;
      await cart.save();
    }

    // Populate thông tin chi tiết
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "items.product",
        select: "name price discount thumbnail images",
      })
      .populate({
        path: "items.variant",
        select: "priceFinal price color sizes",
      })
      .populate({
        path: "items.color",
        select: "name hexCode",
      })
      .populate({
        path: "items.size",
        select: "value",
      });

    return updatedCart;
  },

  /**
   * Thêm sản phẩm vào giỏ hàng
   * @param {String} userId - ID người dùng
   * @param {Object} itemData - Thông tin sản phẩm
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  addToCart: async (userId, itemData) => {
    const { productId, colorId, sizeId, quantity = 1 } = itemData;

    // Kiểm tra các trường bắt buộc
    if (!productId || !colorId || !sizeId) {
      throw new Error("Vui lòng cung cấp đầy đủ thông tin sản phẩm");
    }

    // Kiểm tra sản phẩm tồn tại và còn hàng
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    if (!product.isActive) {
      throw new Error("Sản phẩm không còn kinh doanh");
    }

    if (product.stockStatus === "outOfStock") {
      throw new Error("Sản phẩm đã hết hàng");
    }

    // Kiểm tra biến thể sản phẩm
    const variant = product.variants.find(
      (v) => v.color.toString() === colorId.toString()
    );

    if (!variant) {
      throw new Error("Không tìm thấy màu sắc cho sản phẩm này");
    }

    const sizeInfo = variant.sizes.find(
      (s) => s.size.toString() === sizeId.toString()
    );

    if (!sizeInfo) {
      throw new Error("Không tìm thấy kích thước cho sản phẩm này");
    }

    if (!sizeInfo.isSizeAvailable) {
      throw new Error("Kích thước này hiện không có sẵn");
    }

    if (sizeInfo.quantity < quantity) {
      throw new Error(
        `Chỉ còn ${sizeInfo.quantity} sản phẩm trong kho, vui lòng giảm số lượng`
      );
    }

    // Tìm hoặc tạo giỏ hàng cho người dùng
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = await Cart.create({
        user: userId,
        items: [],
        totalQuantity: 0,
        totalAmount: 0,
      });
    }

    // Kiểm tra sản phẩm đã có trong giỏ hàng chưa
    const existingItemIndex = cart.items.findIndex(
      (item) =>
        item.product.toString() === productId.toString() &&
        item.color.toString() === colorId.toString() &&
        item.size.toString() === sizeId.toString()
    );

    if (existingItemIndex >= 0) {
      // Nếu sản phẩm đã tồn tại, cập nhật số lượng
      cart.items[existingItemIndex].quantity += quantity;

      // Kiểm tra nếu số lượng mới vượt quá số lượng trong kho, điều chỉnh lại
      if (cart.items[existingItemIndex].quantity > sizeInfo.quantity) {
        cart.items[existingItemIndex].quantity = sizeInfo.quantity;
      }
    } else {
      // Nếu sản phẩm chưa có trong giỏ hàng, thêm mới
      // Sử dụng priceFinal của biến thể thay vì giá sản phẩm
      const price = variant.priceFinal || variant.price;
      const discountPrice = price; // Giá priceFinal đã tính discount rồi nên không cần tính lại

      cart.items.push({
        product: productId,
        variant: variant._id,
        color: colorId,
        size: sizeId,
        quantity,
        price,
        discountPrice,
      });
    }

    // Tính lại tổng giỏ hàng
    const { totalQuantity, totalAmount } = calculateCartTotal(cart.items);
    cart.totalQuantity = totalQuantity;
    cart.totalAmount = totalAmount;

    // Lưu giỏ hàng
    await cart.save();

    // Populate thông tin chi tiết
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "items.product",
        select: "name price discount thumbnail images",
      })
      .populate({
        path: "items.variant",
        select: "priceFinal price color sizes",
      })
      .populate({
        path: "items.color",
        select: "name hexCode",
      })
      .populate({
        path: "items.size",
        select: "value",
      });

    return updatedCart;
  },

  /**
   * Cập nhật số lượng sản phẩm trong giỏ hàng
   * @param {String} userId - ID người dùng
   * @param {String} itemId - ID item trong giỏ hàng
   * @param {Number} quantity - Số lượng mới
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  updateCartItem: async (userId, itemId, quantity) => {
    // Kiểm tra số lượng hợp lệ
    if (quantity <= 0) {
      throw new Error("Số lượng phải lớn hơn 0");
    }

    // Tìm giỏ hàng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new Error("Không tìm thấy giỏ hàng");
    }

    // Tìm item trong giỏ hàng
    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId
    );
    if (itemIndex === -1) {
      throw new Error("Không tìm thấy sản phẩm trong giỏ hàng");
    }

    // Lấy thông tin sản phẩm để kiểm tra số lượng tồn kho
    const {
      product: productId,
      color: colorId,
      size: sizeId,
    } = cart.items[itemIndex];
    const product = await Product.findById(productId);

    if (!product) {
      throw new Error("Sản phẩm không còn tồn tại");
    }

    // Kiểm tra số lượng trong kho
    const variant = product.variants.find(
      (v) => v.color.toString() === colorId.toString()
    );

    if (!variant) {
      throw new Error("Biến thể sản phẩm không còn tồn tại");
    }

    const sizeInfo = variant.sizes.find(
      (s) => s.size.toString() === sizeId.toString()
    );

    if (!sizeInfo || !sizeInfo.isSizeAvailable) {
      throw new Error("Kích thước này hiện không có sẵn");
    }

    if (sizeInfo.quantity < quantity) {
      throw new Error(
        `Chỉ còn ${sizeInfo.quantity} sản phẩm trong kho, vui lòng giảm số lượng`
      );
    }

    // Cập nhật số lượng
    cart.items[itemIndex].quantity = quantity;

    // Tính lại tổng giỏ hàng
    const { totalQuantity, totalAmount } = calculateCartTotal(cart.items);
    cart.totalQuantity = totalQuantity;
    cart.totalAmount = totalAmount;

    // Lưu giỏ hàng
    await cart.save();

    // Populate thông tin chi tiết
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "items.product",
        select: "name price discount thumbnail images",
      })
      .populate({
        path: "items.variant",
        select: "priceFinal price color sizes",
      })
      .populate({
        path: "items.color",
        select: "name hexCode",
      })
      .populate({
        path: "items.size",
        select: "value",
      });

    return updatedCart;
  },

  /**
   * Xóa sản phẩm khỏi giỏ hàng
   * @param {String} userId - ID người dùng
   * @param {String} itemId - ID item trong giỏ hàng
   * @returns {Object} - Giỏ hàng đã cập nhật
   */
  removeCartItem: async (userId, itemId) => {
    // Tìm giỏ hàng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new Error("Không tìm thấy giỏ hàng");
    }

    // Tìm và xóa item
    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === itemId
    );
    if (itemIndex === -1) {
      throw new Error("Không tìm thấy sản phẩm trong giỏ hàng");
    }

    // Xóa item khỏi mảng
    cart.items.splice(itemIndex, 1);

    // Tính lại tổng giỏ hàng
    const { totalQuantity, totalAmount } = calculateCartTotal(cart.items);
    cart.totalQuantity = totalQuantity;
    cart.totalAmount = totalAmount;

    // Lưu giỏ hàng
    await cart.save();

    // Populate thông tin chi tiết
    const updatedCart = await Cart.findById(cart._id)
      .populate({
        path: "items.product",
        select: "name price discount thumbnail images",
      })
      .populate({
        path: "items.variant",
        select: "priceFinal price color sizes",
      })
      .populate({
        path: "items.color",
        select: "name hexCode",
      })
      .populate({
        path: "items.size",
        select: "value",
      });

    return updatedCart;
  },

  /**
   * Xóa tất cả sản phẩm khỏi giỏ hàng
   * @param {String} userId - ID người dùng
   * @returns {Object} - Giỏ hàng trống
   */
  clearCart: async (userId) => {
    // Tìm giỏ hàng
    const cart = await Cart.findOne({ user: userId });
    if (!cart) {
      throw new Error("Không tìm thấy giỏ hàng");
    }

    // Xóa tất cả sản phẩm
    cart.items = [];
    cart.totalQuantity = 0;
    cart.totalAmount = 0;

    // Lưu giỏ hàng
    await cart.save();

    return cart;
  },
};

/**
 * Hàm tính tổng giỏ hàng
 * @param {Array} items - Danh sách sản phẩm trong giỏ hàng
 * @returns {Object} - Tổng số lượng và tổng tiền
 */
function calculateCartTotal(items) {
  let totalQuantity = 0;
  let totalAmount = 0;

  items.forEach((item) => {
    totalQuantity += item.quantity;
    // Sử dụng discountPrice (đã là priceFinal của biến thể) để tính tổng tiền
    totalAmount += item.quantity * (item.discountPrice || item.price);
  });

  return {
    totalQuantity,
    totalAmount,
  };
}

module.exports = cartService;
