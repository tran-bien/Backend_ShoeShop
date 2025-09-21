const express = require("express");
const {
  protect,
  requireStaff,
  requireAdminOnly,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");
const categoryController = require("@controllers/admin/category.controller");
const categoryValidator = require("@validators/category.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/v1/admin/categories
 * @desc    Lấy tất cả danh mục (có phân trang, filter)
 * @access  Staff (read-only), Admin
 */
router.get(
  "/",
  requireStaffReadOnly,
  validate(categoryValidator.validateCategoryQuery),
  categoryController.getAllCategories
);

/**
 * @route   GET /api/v1/admin/categories/deleted
 * @desc    Lấy danh sách danh mục đã xóa
 * @access  Admin Only
 */
router.get(
  "/deleted",
  requireAdminOnly,
  validate(categoryValidator.validateCategoryQuery),
  categoryController.getDeletedCategories
);

/**
 * @route   GET /api/v1/admin/categories/:id
 * @desc    Lấy chi tiết danh mục theo ID
 * @access  Staff (read-only), Admin
 */
router.get(
  "/:id",
  requireStaffReadOnly,
  validate(categoryValidator.validateCategoryId),
  categoryController.getCategoryById
);

/**
 * @route   POST /api/v1/admin/categories
 * @desc    Tạo mới danh mục
 * @access  Admin Only
 */
router.post(
  "/",
  requireAdminOnly,
  validate(categoryValidator.validateCategoryData),
  categoryController.createCategory
);

/**
 * @route   PUT /api/v1/admin/categories/:id
 * @desc    Cập nhật danh mục
 * @access  Admin Only
 */
router.put(
  "/:id",
  requireAdminOnly,
  validate([
    ...categoryValidator.validateCategoryId,
    ...categoryValidator.validateCategoryData,
  ]),
  categoryController.updateCategory
);

/**
 * @route   DELETE /api/v1/admin/categories/:id
 * @desc    Xóa mềm danh mục
 * @access  Admin Only
 */
router.delete(
  "/:id",
  requireAdminOnly,
  validate(categoryValidator.validateCategoryId),
  categoryController.deleteCategory
);

/**
 * @route   PUT /api/v1/admin/categories/:id/restore
 * @desc    Khôi phục danh mục đã xóa
 * @access  Admin Only
 */
router.put(
  "/:id/restore",
  requireAdminOnly,
  validate(categoryValidator.validateCategoryId),
  categoryController.restoreCategory
);

/**
 * @route   PATCH /api/v1/admin/categories/:id/status
 * @desc    Cập nhật trạng thái active của danh mục
 * @access  Admin Only
 */
router.patch(
  "/:id/status",
  requireAdminOnly,
  validate(categoryValidator.validateStatusUpdate),
  categoryController.updateCategoryStatus
);

module.exports = router;
