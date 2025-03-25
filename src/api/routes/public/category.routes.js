const express = require("express");
const categoryController = require("@controllers/public/category.controller");
const {
  idValidator,
  slugValidator,
  listCategoriesValidator,
  validateCategory,
} = require("@validators/category.validator");
const router = express.Router();

/**
 * @route   GET /api/categories
 * @desc    Lấy tất cả danh mục
 * @access  Public
 */
router.get(
  "/",
  listCategoriesValidator,
  validateCategory,
  categoryController.getAllCategories
);

/**
 * @route   GET /api/categories/:id
 * @desc    Xem chi tiết danh mục
 * @access  Public
 */
router.get(
  "/:id",
  idValidator,
  validateCategory,
  categoryController.getCategoryById
);

/**
 * @route   GET /api/categories/slug/:slug
 * @desc    Xem danh mục qua URL thân thiện
 * @access  Public
 */
router.get(
  "/slug/:slug",
  slugValidator,
  validateCategory,
  categoryController.getCategoryBySlug
);

/**
 * @route   GET /api/categories/:id/products
 * @desc    Lấy sản phẩm thuộc danh mục
 * @access  Public
 */
router.get(
  "/:id/products",
  idValidator,
  validateCategory,
  categoryController.getProductsByCategory
);

module.exports = router;
