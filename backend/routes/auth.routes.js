const express = require("express");
const { protect } = require("../middlewares/auth.middleware");
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
} = require("../controllers/auth.controller");
const {
  validateRegisterInput,
  validatePassword,
  validateResetPassword,
  validateChangePassword,
} = require("../middlewares/validation.middleware");

const router = express.Router();

// Route công khai
router.post("/register", validateRegisterInput, validatePassword, register);
router.post("/verify-otp", verifyOTP);
router.post("/login", login);
router.delete("/logout", protect, logout);
router.post("/forgot-password", forgotPassword);
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
