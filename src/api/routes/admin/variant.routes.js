const express = require("express");
const router = express.Router();
const variantController = require("@controllers/admin/variant.controller");
const variantValidator = require("@validators/variant.validator");
const validate = require("@utils/validatehelper");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/variants
 * @desc    Lấy danh sách biến thể (có phân trang, filter)
 * @access  Admin
 */
router.get(
  "/",
  validate(variantValidator.validateVariantQuery),
  variantController.getAllVariants
);

/**
 * @route   GET /api/admin/variants/deleted
 * @desc    Lấy danh sách biến thể đã xóa
 * @access  Admin
 */
router.get(
  "/deleted",
  validate(variantValidator.validateVariantQuery),
  variantController.getDeletedVariants
);

/**
 * @route   GET /api/admin/variants/:id
 * @desc    Lấy chi tiết biến thể theo ID
 * @access  Admin
 */
router.get(
  "/:id",
  validate(variantValidator.validateVariantId),
  variantController.getVariantById
);

/**
 * @route   POST /api/admin/variants
 * @desc    Tạo biến thể mới
 * @access  Admin
 */
router.post(
  "/",
  validate(variantValidator.validateVariantData),
  variantController.createVariant
);

/**
 * @route   PUT /api/admin/variants/:id
 * @desc    Cập nhật thông tin biến thể
 * @access  Admin
 */
router.put(
  "/:id",
  validate(variantValidator.validateUpdateVariant),
  variantController.updateVariant
);

/**
 * @route   DELETE /api/admin/variants/:id
 * @desc    Xóa mềm biến thể
 * @access  Admin
 */
router.delete(
  "/:id",
  validate(variantValidator.validateVariantId),
  variantController.deleteVariant
);

/**
 * @route   POST /api/admin/variants/:id/restore
 * @desc    Khôi phục biến thể đã xóa
 * @access  Admin
 */
router.post(
  "/:id/restore",
  validate(variantValidator.validateVariantId),
  variantController.restoreVariant
);

/**
 * @route   PATCH /api/admin/variants/:id/inventory
 * @desc    Cập nhật số lượng tồn kho của biến thể
 * @access  Admin
 */
router.patch(
  "/:id/inventory",
  validate(variantValidator.validateInventoryUpdate),
  variantController.updateInventory
);

/**
 * @route   PATCH /api/admin/variants/:id/status
 * @desc    Cập nhật trạng thái active của biến thể
 * @access  Admin
 */
router.patch(
  "/:id/status",
  validate(variantValidator.validateStatusUpdate),
  variantController.updateVariantStatus
);

module.exports = router;
