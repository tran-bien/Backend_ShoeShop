const express = require("express");
const adminBrandController = require("@controllers/admin/brand.controller");
const { protect, admin } = require("@middlewares/auth.middleware");
const {
  createBrandValidator,
  updateBrandValidator,
  idValidator,
  listBrandsValidator,
} = require("@validators/brand.validator");
const router = express.Router();

// Tất cả routes đều yêu cầu đăng nhập và quyền admin
router.use(protect, admin);

/**
 * @route   GET /api/admin/brands
 * @desc    Lấy tất cả thương hiệu (bao gồm cả đã xóa mềm nếu có query)
 * @access  Admin
 */
router.get("/", listBrandsValidator, adminBrandController.getAllBrands);

/**
 * @route   POST /api/admin/brands
 * @desc    Tạo thương hiệu mới
 * @access  Admin
 */
router.post("/", createBrandValidator, adminBrandController.createBrand);

/**
 * @route   PUT /api/admin/brands/:id
 * @desc    Cập nhật thông tin thương hiệu
 * @access  Admin
 */
router.put("/:id", updateBrandValidator, adminBrandController.updateBrand);

/**
 * @route   DELETE /api/admin/brands/:id
 * @desc    Xóa mềm thương hiệu
 * @access  Admin
 */
router.delete("/:id", idValidator, adminBrandController.softDeleteBrand);

/**
 * @route   PATCH /api/admin/brands/:id/restore
 * @desc    Khôi phục thương hiệu đã xóa mềm
 * @access  Admin
 */
router.patch("/:id/restore", idValidator, adminBrandController.restoreBrand);

module.exports = router;
