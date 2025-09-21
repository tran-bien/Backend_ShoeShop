const express = require("express");
const router = express.Router();
const variantController = require("@controllers/admin/variant.controller");
const variantValidator = require("@validators/variant.validator");
const validate = require("@utils/validatehelper");
const {
  protect,
  requireStaff,
  requireAdminOnly,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
// Variant thuộc quản lý sản phẩm, staff có thể truy cập
// Riêng DELETE sẽ dùng requireAdminOnly cho từng route

/**
 * @route   GET /api/v1/admin/variants
 * @desc    Lấy danh sách biến thể (có phân trang, filter)
 * @access  Staff (read-only), Admin
 */
router.get(
  "/",
  requireStaffReadOnly,
  validate(variantValidator.validateVariantQuery),
  variantController.getAllVariants
);

/**
 * @route   GET /api/v1/admin/variants/deleted
 * @desc    Lấy danh sách biến thể đã xóa
 * @access  Admin Only
 */
router.get(
  "/deleted",
  requireAdminOnly,
  validate(variantValidator.validateVariantQuery),
  variantController.getDeletedVariants
);

/**
 * @route   GET /api/v1/admin/variants/:id
 * @desc    Lấy chi tiết biến thể theo ID
 * @access  Staff (read-only), Admin
 */
router.get(
  "/:id",
  requireStaffReadOnly,
  validate(variantValidator.validateVariantId),
  variantController.getVariantById
);

/**
 * @route   POST /api/v1/admin/variants
 * @desc    Tạo biến thể mới
 * @access  Admin Only
 */
router.post(
  "/",
  requireAdminOnly,
  validate(variantValidator.validateVariantData),
  variantController.createVariant
);

/**
 * @route   PUT /api/v1/admin/variants/:id
 * @desc    Cập nhật thông tin biến thể
 * @access  Admin Only
 */
router.put(
  "/:id",
  requireAdminOnly,
  validate(variantValidator.validateUpdateVariant),
  variantController.updateVariant
);

/**
 * @route   DELETE /api/v1/admin/variants/:id
 * @desc    Xóa mềm biến thể
 * @access  Admin Only
 */
router.delete(
  "/:id",
  requireAdminOnly,
  validate(variantValidator.validateVariantId),
  variantController.deleteVariant
);

/**
 * @route   POST /api/v1/admin/variants/:id/restore
 * @desc    Khôi phục biến thể đã xóa
 * @access  Admin Only
 */
router.post(
  "/:id/restore",
  requireAdminOnly,
  validate(variantValidator.validateVariantId),
  variantController.restoreVariant
);

/**
 * @route   PATCH /api/v1/admin/variants/:id/inventory
 * @desc    Cập nhật số lượng tồn kho của biến thể
 * @access  Admin Only
 */
router.patch(
  "/:id/inventory",
  requireAdminOnly,
  validate(variantValidator.validateInventoryUpdate),
  variantController.updateInventory
);

/**
 * @route   PATCH /api/v1/admin/variants/:id/status
 * @desc    Cập nhật trạng thái active của biến thể
 * @access  Admin Only
 */
router.patch(
  "/:id/status",
  requireAdminOnly,
  validate(variantValidator.validateStatusUpdate),
  variantController.updateVariantStatus
);

module.exports = router;
