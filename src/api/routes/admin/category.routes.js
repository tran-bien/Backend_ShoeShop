const express = require("express");
const adminCategoryController = require("@controllers/admin/category.controller");
const { protect, admin } = require("@middlewares/auth.middleware");
const {
  createCategoryValidator,
  updateCategoryValidator,
  idValidator,
  listCategoriesValidator,
} = require("@validators/category.validator");
const { validate } = require("@validators/index");

const router = express.Router();

// Tất cả routes đều yêu cầu đăng nhập và quyền admin
router.use(protect, admin);

/**
 * @route   GET /api/admin/categories
 * @desc    Lấy tất cả danh mục (bao gồm cả đã xóa mềm nếu có query)
 * @access  Admin
 */
router.get(
  "/",
  listCategoriesValidator,
  validate,
  adminCategoryController.getAllCategories
);

/**
 * @route   POST /api/admin/categories
 * @desc    Tạo danh mục mới
 * @access  Admin
 */
router.post(
  "/",
  createCategoryValidator,
  validate,
  adminCategoryController.createCategory
);

/**
 * @route   PUT /api/admin/categories/:id
 * @desc    Cập nhật thông tin danh mục
 * @access  Admin
 */
router.put(
  "/:id",
  updateCategoryValidator,
  validate,
  adminCategoryController.updateCategory
);

/**
 * @route   DELETE /api/admin/categories/:id
 * @desc    Xóa mềm danh mục
 * @access  Admin
 */
router.delete(
  "/:id",
  idValidator,
  validate,
  adminCategoryController.softDeleteCategory
);

/**
 * @route   PATCH /api/admin/categories/:id/restore
 * @desc    Khôi phục danh mục đã xóa mềm
 * @access  Admin
 */
router.patch(
  "/:id/restore",
  idValidator,
  validate,
  adminCategoryController.restoreCategory
);

module.exports = router;
