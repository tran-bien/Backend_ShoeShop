const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
const {
  addToCart,
  getCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} = require("../controllers/cart.controller");

const router = express.Router();

// Tất cả các route liên quan đến giỏ hàng đều yêu cầu đăng nhập
router.use(protect);

// Route cho giỏ hàng
router.post("/", addToCart);
router.get("/", getCart);
router.put("/:itemId", updateCartItem);
router.delete("/:itemId", removeCartItem);
router.delete("/", clearCart);

module.exports = router;
