const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const authController = require("@controllers/admin/auth.controller");
const authValidator = require("@validators/auth.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

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
