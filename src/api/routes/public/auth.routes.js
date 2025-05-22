const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const authController = require("@controllers/public/auth.controller");
const authValidator = require("@validators/auth.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   POST /api/register
 * @desc    Đăng ký tài khoản
 * @access  Public
 */
router.post(
  "/register",
  validate([
    ...authValidator.validateRegisterInput,
    ...authValidator.validatePassword,
  ]),
  authController.register
);

/**
 * @route   POST /api/verify-otp
 * @desc    Xác thực OTP
 * @access  Public
 */
router.post(
  "/verify-otp",
  validate(authValidator.validateVerifyOTP),
  authController.verifyOTP
);

/**
 * @route   POST /api/login
 * @desc    Đăng nhập
 * @access  Public
 */
router.post(
  "/login",
  validate(authValidator.validateLoginInput),
  authController.login
);

/**
 * @route   DELETE /api/logout
 * @desc    Đăng xuất
 * @access  Private
 */
router.delete("/logout", protect, authController.logout);

/**
 * @route   POST /api/forgot-password
 * @desc    Quên mật khẩu
 * @access  Public
 */
router.post(
  "/forgot-password",
  validate(authValidator.validateForgotPassword),
  authController.forgotPassword
);

/**
 * @route   POST /api/reset-password
 * @desc    Đặt lại mật khẩu
 * @access  Public
 */
router.post(
  "/reset-password",
  validate(authValidator.validateResetPassword),
  authController.resetPassword
);

/**
 * @route   POST /api/refresh-token
 * @desc    Làm mới token
 * @access  Public
 */
router.post(
  "/refresh-token",
  validate(authValidator.validateRefreshToken),
  authController.refreshToken
);

/**
 * @route   POST /api/change-password
 * @desc    Thay đổi mật khẩu
 * @access  Private
 */
router.post(
  "/change-password",
  protect,
  validate(authValidator.validateChangePassword),
  authController.changePassword
);

/**
 * @route   GET /api/sessions
 * @desc    Lấy danh sách phiên đăng nhập
 * @access  Private
 */
router.get("/sessions", protect, authController.getCurrentSessions);

/**
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Đăng xuất khỏi một phiên
 * @access  Private
 */
router.delete(
  "/sessions/:sessionId",
  protect,
  validate(authValidator.validateLogoutSession),
  authController.logoutSession
);

/**
 * @route   DELETE /api/sessions
 * @desc    Đăng xuất khỏi tất cả phiên trừ phiên hiện tại
 * @access  Private
 */
router.delete("/sessions", protect, authController.logoutAllOtherSessions);

/**
 * @route   DELETE /api/logout-all
 * @desc    Đăng xuất khỏi tất cả phiên
 * @access  Private
 */
router.delete("/logout-all", protect, authController.logoutAll);

module.exports = router;
