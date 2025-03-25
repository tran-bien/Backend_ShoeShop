const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const brandController = require("@controllers/admin/brand.controller");
const brandValidator = require("@validators/brand.validator");
const { validateRequest } = require("@middlewares/validateRequest");

const router = express.Router();

// Gom nhóm validators + validateRequest để code ngắn gọn
const validate = (validators) => [
  ...(Array.isArray(validators) ? validators : [validators]),
  validateRequest,
];

/**
 * @route   GET /api/admin/brands
 * @desc    Lấy tất cả thương hiệu (có phân trang, filter)
 * @access  Admin
 */
router.get(
  "/",
  protect,
  admin,
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
  protect,
  admin,
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
  protect,
  admin,
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
  protect,
  admin,
  validate(brandValidator.validateBrandData), // Bao gồm middleware addAuditInfo
  brandController.createBrand
);

/**
 * @route   PUT /api/admin/brands/:id
 * @desc    Cập nhật thương hiệu
 * @access  Admin
 */
router.put(
  "/:id",
  protect,
  admin,
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
  protect,
  admin,
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
  protect,
  admin,
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
  protect,
  admin,
  validate(brandValidator.validateStatusUpdate), // Bao gồm middleware addAuditInfo
  brandController.updateBrandStatus
);

module.exports = router;
