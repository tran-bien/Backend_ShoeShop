const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const categoryController = require("@controllers/admin/category.controller");
const categoryValidator = require("@validators/category.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/categories
 * @desc    Lấy tất cả danh mục (có phân trang, filter)
 * @access  Admin
 */
router.get(
  "/",
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
  validate(categoryValidator.validateStatusUpdate),
  categoryController.updateCategoryStatus
);

module.exports = router;
