const express = require("express");
const {
  protect,
  requireStaff,
  requireAdminOnly,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");
const useCaseController = require("@controllers/admin/useCase.controller");
const useCaseValidator = require("@validators/useCase.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);

/**
 * @route   GET /api/v1/admin/use-cases
 * @desc    Lấy tất cả nhu cầu sử dụng (có phân trang, filter)
 * @access  Staff (read-only), Admin
 */
router.get(
  "/",
  requireStaffReadOnly,
  validate(useCaseValidator.validateUseCaseQuery),
  useCaseController.getAllUseCases
);

/**
 * @route   GET /api/v1/admin/use-cases/deleted
 * @desc    Lấy danh sách nhu cầu sử dụng đã xóa
 * @access  Staff (read-only), Admin
 */
router.get(
  "/deleted",
  requireStaffReadOnly,
  validate(useCaseValidator.validateUseCaseQuery),
  useCaseController.getDeletedUseCases
);

/**
 * @route   GET /api/v1/admin/use-cases/:id
 * @desc    Lấy chi tiết nhu cầu sử dụng theo ID
 * @access  Staff (read-only), Admin
 */
router.get(
  "/:id",
  requireStaffReadOnly,
  validate(useCaseValidator.validateUseCaseId),
  useCaseController.getUseCaseById
);

/**
 * @route   POST /api/v1/admin/use-cases
 * @desc    Tạo mới nhu cầu sử dụng
 * @access  Admin Only
 */
router.post(
  "/",
  requireAdminOnly,
  validate(useCaseValidator.validateCreateUseCase),
  useCaseController.createUseCase
);

/**
 * @route   PUT /api/v1/admin/use-cases/:id
 * @desc    Cập nhật nhu cầu sử dụng
 * @access  Admin Only
 */
router.put(
  "/:id",
  requireAdminOnly,
  validate([
    ...useCaseValidator.validateUseCaseId,
    ...useCaseValidator.validateUpdateUseCase,
  ]),
  useCaseController.updateUseCase
);

/**
 * @route   DELETE /api/v1/admin/use-cases/:id
 * @desc    Xóa mềm nhu cầu sử dụng
 * @access  Admin Only
 */
router.delete(
  "/:id",
  requireAdminOnly,
  validate(useCaseValidator.validateUseCaseId),
  useCaseController.deleteUseCase
);

/**
 * @route   PUT /api/v1/admin/use-cases/:id/restore
 * @desc    Khôi phục nhu cầu sử dụng đã xóa
 * @access  Admin Only
 */
router.put(
  "/:id/restore",
  requireAdminOnly,
  validate(useCaseValidator.validateUseCaseId),
  useCaseController.restoreUseCase
);

module.exports = router;
