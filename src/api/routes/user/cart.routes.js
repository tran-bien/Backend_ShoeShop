const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const cartController = require("@controllers/user/cart.controller");
const cartValidator = require("@validators/cart.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/users/cart
 * @desc    Lấy giỏ hàng hiện tại
 * @access  Private
 */
router.get("/", protect, cartController.getCart);

/**
 * @route   POST /api/users/cart/items
 * @desc    Thêm sản phẩm vào giỏ hàng
 * @access  Private
 */
router.post(
  "/items",
  protect,
  validate(cartValidator.validateAddToCart),
  cartController.addToCart
);

/**
 * @route   PUT /api/users/cart/items/:itemId
 * @desc    Cập nhật số lượng sản phẩm
 * @access  Private
 */
router.put(
  "/items/:itemId",
  protect,
  validate(cartValidator.validateUpdateCartItem),
  cartController.updateCartItem
);

/**
 * @route   DELETE /api/users/cart/items/:itemId
 * @desc    Xóa sản phẩm khỏi giỏ hàng
 * @access  Private
 */
router.delete(
  "/items/:itemId",
  protect,
  validate(cartValidator.validateRemoveFromCart),
  cartController.removeCartItem
);

/**
 * @route   DELETE /api/users/cart
 * @desc    Xóa toàn bộ giỏ hàng
 * @access  Private
 */
router.delete("/", protect, cartController.clearCart);

/**
 * @route   POST /api/users/cart/apply-coupon
 * @desc    Áp dụng mã giảm giá
 * @access  Private
 */
router.post(
  "/apply-coupon",
  protect,
  validate(cartValidator.validateApplyCoupon),
  cartController.applyCoupon
);

/**
 * @route   DELETE /api/users/cart/remove-coupon
 * @desc    Hủy mã giảm giá
 * @access  Private
 */
router.delete("/remove-coupon", protect, cartController.removeCoupon);

/**
 * @route   POST /api/users/cart/checkout
 * @desc    Chuẩn bị thanh toán
 * @access  Private
 */
router.post("/checkout", protect, cartController.checkout);

module.exports = router;
