const asyncHandler = require("express-async-handler");

const cartService = require("../../services/cart.service");

// Lấy giỏ hàng của người dùng
exports.getUserCart = asyncHandler(async (req, res) => {
  try {
    const cart = await cartService.getUserCart(req.user.id);
    res.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    res.status(500);
    throw new Error(error.message);
  }
});

// Thêm sản phẩm vào giỏ hàng
exports.addItemToCart = asyncHandler(async (req, res) => {
  try {
    const { productId, variantId, sizeId, quantity } = req.body;
    const cart = await cartService.addItemToCart(req.user.id, {
      productId,
      variantId,
      sizeId,
      quantity,
    });

    res.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Cập nhật số lượng sản phẩm trong giỏ hàng
exports.updateCartItem = asyncHandler(async (req, res) => {
  try {
    const { itemId, quantity } = req.body;
    const cart = await cartService.updateCartItemQuantity(
      req.user.id,
      itemId,
      quantity
    );

    res.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Xóa sản phẩm khỏi giỏ hàng
exports.removeCartItem = asyncHandler(async (req, res) => {
  try {
    const cart = await cartService.removeCartItem(
      req.user.id,
      req.params.itemId
    );

    res.json({
      success: true,
      data: cart,
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// Xóa tất cả sản phẩm trong giỏ hàng
exports.clearCart = asyncHandler(async (req, res) => {
  try {
    const cart = await cartService.clearCart(req.user.id);

    res.json({
      success: true,
      data: cart,
      message: "Giỏ hàng đã được làm trống",
    });
  } catch (error) {
    res.status(500);
    throw new Error(error.message);
  }
});

// Áp dụng mã giảm giá
exports.applyCoupon = asyncHandler(async (req, res) => {
  try {
    const { couponCode } = req.body;
    const cart = await cartService.applyCoupon(req.user.id, couponCode);

    res.json({
      success: true,
      data: cart,
      message: "Mã giảm giá đã được áp dụng",
    });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});
