const express = require("express");
const router = express.Router();
const sizeController = require("@controllers/admin/size.controller");
const sizeValidator = require("@validators/size.validator");
const validate = require("@utils/validatehelper");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/sizes
 * @desc    Lấy danh sách tất cả kích thước (admin)
 * @access  Admin
 */
router.get(
  "/",
  validate(sizeValidator.validateListQuery),
  sizeController.getAllSizes
);

/**
 * @route   GET /api/admin/sizes/deleted
 * @desc    Lấy danh sách kích thước đã xóa
 * @access  Admin
 */
router.get(
  "/deleted",
  validate(sizeValidator.validateListQuery),
  sizeController.getDeletedSizes
);

/**
 * @route   GET /api/admin/sizes/:id
 * @desc    Lấy thông tin chi tiết kích thước theo ID
 * @access  Admin
 */
router.get(
  "/:id",
  validate(sizeValidator.validateSizeId),
  sizeController.getSizeById
);

/**
 * @route   POST /api/admin/sizes
 * @desc    Tạo kích thước mới
 * @access  Admin
 */
router.post(
  "/",
  validate(sizeValidator.validateCreateSize),
  sizeController.createSize
);

/**
 * @route   PUT /api/admin/sizes/:id
 * @desc    Cập nhật kích thước
 * @access  Admin
 */
router.put(
  "/:id",
  validate(sizeValidator.validateUpdateSize),
  sizeController.updateSize
);

/**
 * @route   DELETE /api/admin/sizes/:id
 * @desc    Xóa kích thước (soft delete)
 * @access  Admin
 */
router.delete(
  "/:id",
  validate(sizeValidator.validateSizeId),
  sizeController.deleteSize
);

/**
 * @route   PUT /api/admin/sizes/:id/restore
 * @desc    Khôi phục kích thước đã xóa
 * @access  Admin
 */
router.put(
  "/:id/restore",
  validate(sizeValidator.validateSizeId),
  sizeController.restoreSize
);

module.exports = router;
