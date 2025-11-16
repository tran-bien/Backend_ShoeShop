const express = require("express");
const router = express.Router();
const blogCategoryController = require("@controllers/blogCategory.controller");
const {
  protect,
  requireStaffOrAdmin,
} = require("@middlewares/auth.middleware");

router.use(protect);
router.use(requireStaffOrAdmin);

/**
 * @route GET /api/v1/admin/blogs/categories
 * @desc [ADMIN] Lấy tất cả categories (kể cả inactive)
 * @access Admin
 */
router.get("/", blogCategoryController.getAdminCategories);

/**
 * @route GET /api/v1/admin/blogs/categories/:id
 * @desc [ADMIN] Lấy chi tiết category
 * @access Admin
 */
router.get("/:id", blogCategoryController.getCategoryById);

/**
 * @route POST /api/v1/admin/blogs/categories
 * @desc [ADMIN] Tạo category mới
 * @access Admin
 */
router.post("/", blogCategoryController.createCategory);

/**
 * @route PUT /api/v1/admin/blogs/categories/:id
 * @desc [ADMIN] Cập nhật category
 * @access Admin
 */
router.put("/:id", blogCategoryController.updateCategory);

/**
 * @route DELETE /api/v1/admin/blogs/categories/:id
 * @desc [ADMIN] Xóa category (soft delete)
 * @access Admin
 */
router.delete("/:id", blogCategoryController.deleteCategory);

module.exports = router;
