const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const authController = require("@controllers/admin/auth.controller");
const authValidator = require("@validators/auth.validator");
const { validateRequest } = require("@middlewares/validateRequest");

const router = express.Router();

// Gom nhóm validators + validateRequest để code ngắn gọn
const validate = (validators) => [
  ...(Array.isArray(validators) ? validators : [validators]),
  validateRequest,
];

/**
 * @route   GET /api/admin/sessions
 * @desc    Lấy toàn bộ session
 * @access  Admin
 */
router.get("/sessions", protect, admin, authController.getAllSessions);

/**
 * @route   DELETE /api/admin/logout/:userId
 * @desc    Đăng xuất user bất kỳ
 * @access  Admin
 */
router.delete(
  "/logout/:userId",
  protect,
  admin,
  validate(authValidator.validateAdminLogoutUser),
  authController.adminLogoutUser
);

module.exports = router;
