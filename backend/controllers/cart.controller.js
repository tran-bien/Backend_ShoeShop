const asyncHandler = require("express-async-handler");
const Cart = require("../models/cart.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const cartService = require("../services/cart.service");

// Lấy giỏ hàng của người dùng
exports.getCart = asyncHandler(async (req, res) => {
  try {
    // Sử dụng cartService để lấy giỏ hàng của người dùng
    const cart = await cartService.getCart(req.user._id);

    res.status(200).json({
      success: true,
      data: cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy giỏ hàng",
    });
  }
});

// Thêm sản phẩm vào giỏ hàng
exports.addToCart = asyncHandler(async (req, res) => {
  try {
    const { productId, colorId, sizeId, quantity = 1 } = req.body;

    // Sử dụng cartService để thêm sản phẩm vào giỏ hàng
    const cart = await cartService.addToCart(req.user._id, {
      productId,
      colorId,
      sizeId,
      quantity,
    });

    res.status(200).json({
      success: true,
      message: "Đã thêm sản phẩm vào giỏ hàng",
      data: cart,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi thêm sản phẩm vào giỏ hàng",
    });
  }
});

// Cập nhật số lượng sản phẩm trong giỏ hàng
exports.updateCartItem = asyncHandler(async (req, res) => {
  try {
    const { itemId } = req.params;
    const { quantity } = req.body;

    // Sử dụng cartService để cập nhật số lượng sản phẩm
    const cart = await cartService.updateCartItem(
      req.user._id,
      itemId,
      quantity
    );

    res.status(200).json({
      success: true,
      message: "Đã cập nhật số lượng sản phẩm",
      data: cart,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật giỏ hàng",
    });
  }
});

// Xóa sản phẩm khỏi giỏ hàng
exports.removeCartItem = asyncHandler(async (req, res) => {
  try {
    const { itemId } = req.params;

    // Sử dụng cartService để xóa sản phẩm khỏi giỏ hàng
    const updatedCart = await cartService.removeCartItem(req.user._id, itemId);

    res.status(200).json({
      success: true,
      message: "Đã xóa sản phẩm khỏi giỏ hàng",
      data: updatedCart,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi xóa sản phẩm khỏi giỏ hàng",
    });
  }
});

// Xóa toàn bộ giỏ hàng
exports.clearCart = asyncHandler(async (req, res) => {
  try {
    // Sử dụng cartService để xóa toàn bộ giỏ hàng
    await cartService.clearCart(req.user._id);

    res.status(200).json({
      success: true,
      message: "Đã xóa toàn bộ giỏ hàng",
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi xóa giỏ hàng",
    });
  }
});
