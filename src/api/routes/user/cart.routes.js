const express = require("express");
const router = express.Router();
const cartController = require("@controllers/user/cart.controller");
const cartValidator = require("@validators/cart.validator");
const validate = require("@utils/validatehelper");
const { protect } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/cart
 * @desc    Lấy giỏ hàng hiện tại
 * @access  Private
 */
router.get("/", cartController.getCart);

/**
 * @route   POST /api/cart/items
 * @desc    Thêm sản phẩm vào giỏ hàng
 * @access  Private
 */
router.post(
  "/items",
  validate(cartValidator.validateAddToCart),
  cartController.addToCart
);

/**
 * @route   PUT /api/cart/items/:itemId
 * @desc    Cập nhật số lượng sản phẩm
 * @access  Private
 */
router.put(
  "/items/:itemId",
  validate(cartValidator.validateUpdateCartItem),
  cartController.updateCartItem
);

/**
 * @route   DELETE /api/cart/items
 * @desc    Xóa sản phẩm đã chọn khỏi giỏ hàng
 * @access  Private
 */
router.delete(
  "/items",
  cartController.removeCartItems
);

/**
 * @route   DELETE /api/cart
 * @desc    Xóa toàn bộ giỏ hàng
 * @access  Private
 */
router.delete("/", cartController.clearCart);

/**
 * @route   POST /api/cart/apply-coupon
 * @desc    Áp dụng mã giảm giá
 * @access  Private
 */
router.post(
  "/apply-coupon",
  validate(cartValidator.validateApplyCoupon),
  cartController.applyCoupon
);

/**
 * @route   POST /api/cart/remove-coupon
 * @desc    Hủy mã giảm giá
 * @access  Private
 */
router.post(
  "/remove-coupon",
  validate(cartValidator.validateRemoveCoupon),
  cartController.removeCoupon
);

/**
 * @route   POST /api/cart/checkout
 * @desc    Chuẩn bị thanh toán
 * @access  Private
 */
router.post("/checkout", cartController.checkout);

/**
 * @route   PATCH /api/cart/items/select
 * @desc    Chọn/bỏ chọn sản phẩm trong giỏ hàng
 * @access  Private
 */
router.patch(
  "/items/select",
  validate(cartValidator.validateToggleSelectItems),
  cartController.toggleSelectCartItems
);

module.exports = router;