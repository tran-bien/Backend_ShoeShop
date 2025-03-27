const express = require("express");
const categoryController = require("@controllers/public/category.controller");
const categoryValidator = require("@validators/category.validator");
const { validateRequest } = require("@middlewares/validateRequest");

const router = express.Router();

// Gom nhóm validators + validateRequest để code ngắn gọn
const validate = (validators) => [
  ...(Array.isArray(validators) ? validators : [validators]),
  validateRequest,
];

/**
 * @route   GET /api/categories
 * @desc    Lấy tất cả danh mục đang active và chưa xóa
 * @access  Public
 */
router.get(
  "/",
  validate(categoryValidator.validatePublicCategoryQuery),
  categoryController.getPublicAllCategories
);

/**
 * @route   GET /api/categories/slug/:slug
 * @desc    Lấy chi tiết danh mục theo slug
 * @access  Public
 */
router.get(
  "/slug/:slug",
  validate(categoryValidator.validateCategorySlug),
  categoryController.getCategoryBySlug
);

/**
 * @route   GET /api/categories/:id
 * @desc    Lấy chi tiết danh mục theo ID
 * @access  Public
 */
router.get(
  "/:id",
  validate(categoryValidator.validateCategoryId),
  categoryController.getPublicCategoryById
);

module.exports = router;
