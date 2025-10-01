const express = require("express");
const {
  protect,
  requireStaff,
  requireAdminOnly,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");
const materialController = require("@controllers/admin/material.controller");
const materialValidator = require("@validators/material.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/v1/admin/materials
 * @desc    Lấy tất cả vật liệu (có phân trang, filter)
 * @access  Staff (read-only), Admin
 */
router.get(
  "/",
  requireStaffReadOnly,
  validate(materialValidator.validateGetMaterials),
  materialController.getAllMaterials
);

/**
 * @route   GET /api/v1/admin/materials/deleted
 * @desc    Lấy danh sách vật liệu đã xóa
 * @access  Staff (read-only), Admin
 */
router.get(
  "/deleted",
  requireStaffReadOnly,
  validate(materialValidator.validateGetMaterials),
  materialController.getDeletedMaterials
);

/**
 * @route   GET /api/v1/admin/materials/:id
 * @desc    Lấy chi tiết vật liệu theo ID
 * @access  Staff (read-only), Admin
 */
router.get(
  "/:id",
  requireStaffReadOnly,
  validate(materialValidator.validateMaterialId),
  materialController.getMaterialById
);

/**
 * @route   POST /api/v1/admin/materials
 * @desc    Tạo mới vật liệu
 * @access  Admin Only
 */
router.post(
  "/",
  requireAdminOnly,
  validate(materialValidator.validateCreateMaterial),
  materialController.createMaterial
);

/**
 * @route   PUT /api/v1/admin/materials/:id
 * @desc    Cập nhật vật liệu
 * @access  Admin Only
 */
router.put(
  "/:id",
  requireAdminOnly,
  validate([
    ...materialValidator.validateMaterialId,
    ...materialValidator.validateUpdateMaterial,
  ]),
  materialController.updateMaterial
);

/**
 * @route   DELETE /api/v1/admin/materials/:id
 * @desc    Xóa mềm vật liệu
 * @access  Admin Only
 */
router.delete(
  "/:id",
  requireAdminOnly,
  validate(materialValidator.validateMaterialId),
  materialController.deleteMaterial
);

/**
 * @route   PATCH /api/v1/admin/materials/:id/status
 * @desc    Cập nhật trạng thái kích hoạt vật liệu
 * @access  Admin Only
 */
router.patch(
  "/:id/status",
  requireAdminOnly,
  validate(materialValidator.validateStatusUpdate),
  materialController.updateMaterialStatus
);

/**
 * @route   PUT /api/v1/admin/materials/:id/restore
 * @desc    Khôi phục vật liệu đã xóa
 * @access  Admin Only
 */
router.put(
  "/:id/restore",
  requireAdminOnly,
  validate(materialValidator.validateMaterialId),
  materialController.restoreMaterial
);

module.exports = router;
