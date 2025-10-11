const express = require("express");
const {
  protect,
  requireStaff,
  requireStaffOrAdmin,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");
const brandController = require("@controllers/admin/brand.controller");
const brandValidator = require("@validators/brand.validator");
const validate = require("@utils/validatehelper");
const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/v1/admin/brands
 * @desc    Lấy tất cả thương hiệu (có phân trang, filter)
 * @access  Staff (read-only), Admin
 */
router.get(
  "/",
  requireStaffReadOnly,
  validate(brandValidator.validateBrandQuery),
  brandController.getAllBrands
);

/**
 * @route   GET /api/v1/admin/brands/deleted
 * @desc    Lấy danh sách thương hiệu đã xóa
 * @access  Staff (read-only), Admin
 */
router.get(
  "/deleted",
  requireStaffReadOnly,
  validate(brandValidator.validateBrandQuery),
  brandController.getDeletedBrands
);

/**
 * @route   GET /api/v1/admin/brands/:id
 * @desc    Lấy chi tiết thương hiệu theo ID
 * @access  Staff (read-only), Admin
 */
router.get(
  "/:id",
  requireStaffReadOnly,
  validate(brandValidator.validateBrandId),
  brandController.getBrandById
);

/**
 * @route   POST /api/v1/admin/brands
 * @desc    Tạo mới thương hiệu
 * @access  Admin Only
 */
router.post(
  "/",
  requireStaffOrAdmin,
  validate(brandValidator.validateBrandData),
  brandController.createBrand
);

/**
 * @route   PUT /api/v1/admin/brands/:id
 * @desc    Cập nhật thương hiệu
 * @access  Admin Only
 */
router.put(
  "/:id",
  requireStaffOrAdmin,
  validate([
    ...brandValidator.validateBrandId,
    ...brandValidator.validateBrandData,
  ]),
  brandController.updateBrand
);

/**
 * @route   DELETE /api/v1/admin/brands/:id
 * @desc    Xóa mềm thương hiệu
 * @access  Admin Only
 */
router.delete(
  "/:id",
  requireStaffOrAdmin,
  validate(brandValidator.validateBrandId),
  brandController.deleteBrand
);

/**
 * @route   PUT /api/v1/admin/brands/:id/restore
 * @desc    Khôi phục thương hiệu đã xóa
 * @access  Admin Only
 */
router.put(
  "/:id/restore",
  requireStaffOrAdmin,
  validate(brandValidator.validateBrandId),
  brandController.restoreBrand
);

/**
 * @route   PATCH /api/v1/admin/brands/:id/status
 * @desc    Cập nhật trạng thái active của thương hiệu
 * @access  Admin Only
 */
router.patch(
  "/:id/status",
  requireStaffOrAdmin,
  validate(brandValidator.validateStatusUpdate),
  brandController.updateBrandStatus
);

module.exports = router;
