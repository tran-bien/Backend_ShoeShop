const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const wishlistController = require("@controllers/user/wishlist.controller");
const userValidator = require("@validators/user.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/users/wishlist
 * @desc    Lấy danh sách yêu thích
 * @access  Private
 */
router.get("/wishlist", protect, wishlistController.getUserWishlist);

/**
 * @route   POST /api/users/wishlist
 * @desc    Thêm sản phẩm vào danh sách yêu thích
 * @access  Private
 */
router.post(
  "/wishlist",
  protect,
  validate(userValidator.validateAddToWishlist),
  wishlistController.addToWishlist
);

/**
 * @route   DELETE /api/users/wishlist/:id
 * @desc    Xóa sản phẩm khỏi danh sách yêu thích
 * @access  Private
 */
router.delete("/wishlist/:id", protect, wishlistController.removeFromWishlist);

module.exports = router;
