const asyncHandler = require("express-async-handler");
const cartService = require("@services/cart.service");

/**
 * @desc    Lấy giỏ hàng hiện tại
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await cartService.getCartByUser(userId);
  
  res.status(200).json(result);
});

/**
 * @desc    Thêm sản phẩm vào giỏ hàng
 * @route   POST /api/cart/items
 * @access  Private
 */
const addToCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const itemData = req.body;
  const result = await cartService.addToCart(userId, itemData);
  
  res.status(201).json(result);
});

/**
 * @desc    Cập nhật số lượng sản phẩm trong giỏ hàng
 * @route   PUT /api/cart/items/:itemId
 * @access  Private
 */
const updateCartItem = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { itemId } = req.params;
  const { quantity } = req.body;
  const result = await cartService.updateCartItem(userId, itemId, quantity);
  
  res.status(200).json(result);
});

/**
 * @desc    Xóa sản phẩm đã chọn khỏi giỏ hàng
 * @route   DELETE /api/cart/items
 * @access  Private
 */
const removeCartItems = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await cartService.removeCartItem(userId);
  
  res.status(200).json(result);
});

/**
 * @desc    Xóa toàn bộ giỏ hàng
 * @route   DELETE /api/cart
 * @access  Private
 */
const clearCart = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await cartService.clearCart(userId);
  
  res.status(200).json(result);
});

/**
 * @desc    Áp dụng mã giảm giá
 * @route   POST /api/cart/apply-coupon
 * @access  Private
 */
const applyCoupon = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { couponCode, itemIds } = req.body;
  const result = await cartService.applyCoupon(userId, { couponCode, itemIds });
  
  res.status(200).json(result);
});

/**
 * @desc    Hủy mã giảm giá
 * @route   POST /api/cart/remove-coupon
 * @access  Private
 */
const removeCoupon = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { itemIds } = req.body;
  const result = await cartService.removeCoupon(userId, { itemIds });
  
  res.status(200).json(result);
});

/**
 * @desc    Chuẩn bị thanh toán
 * @route   POST /api/cart/checkout
 * @access  Private
 */
const checkout = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await cartService.prepareCheckout(userId);
  
  res.status(200).json(result);
});

/**
 * @desc    Chọn/bỏ chọn sản phẩm trong giỏ hàng
 * @route   PATCH /api/cart/items/select
 * @access  Private
 */
const toggleSelectCartItems = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const result = await cartService.toggleSelectCartItems(userId, req.body);
  
  res.status(200).json(result);
});

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItems,
  clearCart,
  applyCoupon,
  removeCoupon,
  checkout,
  toggleSelectCartItems
};