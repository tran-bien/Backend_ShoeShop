const express = require("express");
const router = express.Router();
const colorController = require("@controllers/admin/color.controller");
const colorValidator = require("@validators/color.validator");
const validate = require("@utils/validatehelper");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/colors
 * @desc    Lấy danh sách tất cả màu sắc (admin)
 * @access  Admin
 */
router.get(
  "/",
  validate(colorValidator.validateListQuery),
  colorController.getAllColors
);

/**
 * @route   GET /api/admin/colors/deleted
 * @desc    Lấy danh sách màu sắc đã xóa
 * @access  Admin
 */
router.get(
  "/deleted",
  validate(colorValidator.validateListQuery),
  colorController.getDeletedColors
);

/**
 * @route   GET /api/admin/colors/:id
 * @desc    Lấy thông tin chi tiết màu sắc theo ID
 * @access  Admin
 */
router.get(
  "/:id",
  validate(colorValidator.validateColorId),
  colorController.getColorById
);

/**
 * @route   POST /api/admin/colors
 * @desc    Tạo màu sắc mới
 * @access  Admin
 */
router.post(
  "/",
  validate(colorValidator.validateCreateColor),
  colorController.createColor
);

/**
 * @route   PUT /api/admin/colors/:id
 * @desc    Cập nhật màu sắc
 * @access  Admin
 */
router.put(
  "/:id",
  validate(colorValidator.validateUpdateColor),
  colorController.updateColor
);

/**
 * @route   DELETE /api/admin/colors/:id
 * @desc    Xóa màu sắc (soft delete)
 * @access  Admin
 */
router.delete(
  "/:id",
  validate(colorValidator.validateColorId),
  colorController.deleteColor
);

/**
 * @route   PUT /api/admin/colors/:id/restore
 * @desc    Khôi phục màu sắc đã xóa
 * @access  Admin
 */
router.put(
  "/:id/restore",
  validate(colorValidator.validateColorId),
  colorController.restoreColor
);

module.exports = router;
