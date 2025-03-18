const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const authController = require("@controllers/public/auth.controller");
const {
  register,
  verifyOTP,
  login,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getCurrentSessions,
  logoutSession,
  logoutAllOtherSessions,
  logoutAll,
} = authController;
const {
  validateForgotPassword,
  validateRegisterInput,
  validatePassword,
  validateResetPassword,
  validateChangePassword,
  validateLoginInput,
  validateVerifyOTP,
} = require("@validators/auth.validator");

const router = express.Router();

// Route công khai
router.post("/register", validateRegisterInput, validatePassword, register);
router.post("/verify-otp", validateVerifyOTP, verifyOTP);
router.post("/login", validateLoginInput, login);
router.delete("/logout", protect, logout);
router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.post("/reset-password", validateResetPassword, resetPassword);

// Route yêu cầu xác thực
router.post(
  "/change-password",
  protect,
  validateChangePassword,
  changePassword
);

// Quản lý phiên đăng nhập (yêu cầu đăng nhập)
router.get("/sessions", protect, getCurrentSessions);
router.delete("/sessions/:sessionId", protect, logoutSession);
router.delete("/sessions", protect, logoutAllOtherSessions);
router.delete("/logout-all", protect, logoutAll);

module.exports = router;
