const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const categoryController = require("@controllers/admin/category.controller");
const categoryValidator = require("@validators/category.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/admin/categories
 * @desc    Lấy tất cả danh mục (có phân trang, filter)
 * @access  Admin
 */
router.get(
  "/",
  protect,
  admin,
  validate(categoryValidator.validateCategoryQuery),
  categoryController.getAllCategories
);

/**
 * @route   GET /api/admin/categories/deleted
 * @desc    Lấy danh sách danh mục đã xóa
 * @access  Admin
 */
router.get(
  "/deleted",
  protect,
  admin,
  validate(categoryValidator.validateCategoryQuery),
  categoryController.getDeletedCategories
);

/**
 * @route   GET /api/admin/categories/:id
 * @desc    Lấy chi tiết danh mục theo ID
 * @access  Admin
 */
router.get(
  "/:id",
  protect,
  admin,
  validate(categoryValidator.validateCategoryId),
  categoryController.getCategoryById
);

/**
 * @route   POST /api/admin/categories
 * @desc    Tạo mới danh mục
 * @access  Admin
 */
router.post(
  "/",
  protect,
  admin,
  validate(categoryValidator.validateCategoryData),
  categoryController.createCategory
);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Cập nhật danh mục
 * @access  Admin
 */
router.put(
  "/:id",
  protect,
  admin,
  validate([
    ...categoryValidator.validateCategoryId,
    ...categoryValidator.validateCategoryData,
  ]),
  categoryController.updateCategory
);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Xóa mềm danh mục
 * @access  Admin
 */
router.delete(
  "/:id",
  protect,
  admin,
  validate(categoryValidator.validateCategoryId),
  categoryController.deleteCategory
);

/**
 * @route   PUT /api/admin/categories/:id/restore
 * @desc    Khôi phục danh mục đã xóa
 * @access  Admin
 */
router.put(
  "/:id/restore",
  protect,
  admin,
  validate(categoryValidator.validateCategoryId),
  categoryController.restoreCategory
);

/**
 * @route   PATCH /api/admin/categories/:id/status
 * @desc    Cập nhật trạng thái active của danh mục
 * @access  Admin
 */
router.patch(
  "/:id/status",
  protect,
  admin,
  validate(categoryValidator.validateStatusUpdate),
  categoryController.updateCategoryStatus
);

module.exports = router;
