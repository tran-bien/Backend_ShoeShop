const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const {
  getAllSessions,
  adminLogoutUser,
} = require("@controllers/admin/auth.controller");
const { validateAdminLogoutUser } = require("@validators/auth.validator");

const router = express.Router();

// GET /api/admin/sessions - Lấy toàn bộ session
router.get("/sessions", protect, admin, getAllSessions);

// DELETE /api/admin/logout/:userId - Đăng xuất user bất kỳ
router.delete(
  "/logout/:userId",
  protect,
  admin,
  validateAdminLogoutUser,
  adminLogoutUser
);

module.exports = router;
