const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const userController = require("@controllers/admin/user.controller");
const userValidator = require("@validators/user.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/admin/users
 * @desc    Lấy danh sách người dùng (phân trang)
 * @access  Admin
 */
router.get("/", protect, admin, userController.getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Lấy chi tiết người dùng
 * @access  Admin
 */
router.get("/:id", protect, admin, userController.getUserDetails);

/**
 * @route   PUT /api/admin/users/:id/block
 * @desc    Khóa/mở khóa tài khoản người dùng
 * @access  Admin
 */
router.put(
  "/:id/block",
  protect,
  admin,
  validate(userValidator.validateToggleUserBlock),
  userController.toggleUserBlock
);

module.exports = router;
