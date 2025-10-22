const express = require("express");
const router = express.Router();
const tagController = require("@controllers/admin/tag.controller");
const tagValidator = require("@validators/tag.validator");
const {
  protect,
  requireStaffOrAdmin,
  requireStaffReadOnly,
} = require("@middlewares/auth.middleware");

// Tất cả routes đều yêu cầu authentication
router.use(protect);

/**
 * @route   GET /api/admin/tags/deleted
 * @desc    Lấy danh sách tags đã xóa
 * @access  Staff/Admin
 */
router.get(
  "/deleted",
  requireStaffOrAdmin,
  tagValidator.getDeletedTags,
  tagController.getDeletedTags
);

/**
 * @route   GET /api/admin/tags
 * @desc    Lấy tất cả tags
 * @access  Staff/Admin
 */
router.get(
  "/",
  requireStaffOrAdmin,
  tagValidator.getAllTags,
  tagController.getAllTags
);

/**
 * @route   POST /api/admin/tags
 * @desc    Tạo tag mới
 * @access  Staff/Admin
 */
router.post(
  "/",
  requireStaffOrAdmin,
  tagValidator.createTag,
  tagController.createTag
);

/**
 * @route   GET /api/admin/tags/:id
 * @desc    Lấy chi tiết tag theo ID
 * @access  Staff/Admin
 */
router.get(
  "/:id",
  requireStaffOrAdmin,
  tagValidator.getTagById,
  tagController.getTagById
);

/**
 * @route   PUT /api/admin/tags/:id
 * @desc    Cập nhật tag
 * @access  Staff/Admin (Full)
 */
router.put(
  "/:id",
  requireStaffOrAdmin,
  tagValidator.updateTag,
  tagController.updateTag
);

/**
 * @route   DELETE /api/admin/tags/:id
 * @desc    Xóa mềm tag
 * @access  Staff/Admin (Full)
 */
router.delete(
  "/:id",
  requireStaffOrAdmin,
  tagValidator.deleteTag,
  tagController.deleteTag
);

/**
 * @route   PATCH /api/admin/tags/:id/restore
 * @desc    Khôi phục tag đã xóa
 * @access  Staff/Admin (Full)
 */
router.patch(
  "/:id/restore",
  requireStaffOrAdmin,
  tagValidator.restoreTag,
  tagController.restoreTag
);

/**
 * @route   PATCH /api/admin/tags/:id/status
 * @desc    Cập nhật trạng thái active/inactive
 * @access  Staff/Admin (Full)
 */
router.patch(
  "/:id/status",
  requireStaffOrAdmin,
  tagValidator.updateTagStatus,
  tagController.updateTagStatus
);

module.exports = router;
