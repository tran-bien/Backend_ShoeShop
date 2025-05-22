const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const brandController = require("@controllers/admin/brand.controller");
const brandValidator = require("@validators/brand.validator");
const validate = require("@utils/validatehelper");
const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/brands
 * @desc    Lấy tất cả thương hiệu (có phân trang, filter)
 * @access  Admin
 */
router.get(
  "/",
  validate(brandValidator.validateBrandQuery),
  brandController.getAllBrands
);

/**
 * @route   GET /api/admin/brands/deleted
 * @desc    Lấy danh sách thương hiệu đã xóa
 * @access  Admin
 */
router.get(
  "/deleted",
  validate(brandValidator.validateBrandQuery),
  brandController.getDeletedBrands
);

/**
 * @route   GET /api/admin/brands/:id
 * @desc    Lấy chi tiết thương hiệu theo ID
 * @access  Admin
 */
router.get(
  "/:id",
  validate(brandValidator.validateBrandId),
  brandController.getBrandById
);

/**
 * @route   POST /api/admin/brands
 * @desc    Tạo mới thương hiệu
 * @access  Admin
 */
router.post(
  "/",
  validate(brandValidator.validateBrandData),
  brandController.createBrand
);

/**
 * @route   PUT /api/admin/brands/:id
 * @desc    Cập nhật thương hiệu
 * @access  Admin
 */
router.put(
  "/:id",
  validate([
    ...brandValidator.validateBrandId,
    ...brandValidator.validateBrandData,
  ]),
  brandController.updateBrand
);

/**
 * @route   DELETE /api/admin/brands/:id
 * @desc    Xóa mềm thương hiệu
 * @access  Admin
 */
router.delete(
  "/:id",
  validate(brandValidator.validateBrandId),
  brandController.deleteBrand
);

/**
 * @route   PUT /api/admin/brands/:id/restore
 * @desc    Khôi phục thương hiệu đã xóa
 * @access  Admin
 */
router.put(
  "/:id/restore",
  validate(brandValidator.validateBrandId),
  brandController.restoreBrand
);

/**
 * @route   PATCH /api/admin/brands/:id/status
 * @desc    Cập nhật trạng thái active của thương hiệu
 * @access  Admin
 */
router.patch(
  "/:id/status",
  validate(brandValidator.validateStatusUpdate),
  brandController.updateBrandStatus
);

module.exports = router;
