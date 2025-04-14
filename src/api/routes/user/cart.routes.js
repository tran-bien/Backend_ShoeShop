const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const cartController = require("@controllers/user/cart.controller");
const cartValidator = require("@validators/cart.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/users/cart
 * @desc    Lấy giỏ hàng hiện tại
 * @access  Private
 */
router.get("/", cartController.getCart);

/**
 * @route   POST /api/users/cart/items
 * @desc    Thêm sản phẩm vào giỏ hàng
 * @access  Private
 */
router.post(
  "/items",
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
  validate(cartValidator.validateRemoveFromCart),
  cartController.removeCartItem
);

/**
 * @route   DELETE /api/users/cart
 * @desc    Xóa toàn bộ giỏ hàng
 * @access  Private
 */
router.delete("/", cartController.clearCart);

/**
 * @route   POST /api/users/cart/apply-coupon
 * @desc    Áp dụng mã giảm giá
 * @access  Private
 */
router.post(
  "/apply-coupon",
  validate(cartValidator.validateApplyCoupon),
  cartController.applyCoupon
);

/**
 * @route   DELETE /api/users/cart/remove-coupon
 * @desc    Hủy mã giảm giá
 * @access  Private
 */
router.delete("/remove-coupon", cartController.removeCoupon);

/**
 * @route   POST /api/users/cart/checkout
 * @desc    Chuẩn bị thanh toán
 * @access  Private
 */
router.post("/checkout", cartController.checkout);

module.exports = router;
