const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const userController = require("@controllers/admin/user.controller");
const userValidator = require("@validators/user.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/users
 * @desc    Lấy danh sách người dùng (phân trang)
 * @access  Admin
 */
router.get("/", userController.getAllUsers);

/**
 * @route   GET /api/admin/users/:id
 * @desc    Lấy chi tiết người dùng
 * @access  Admin
 */
router.get("/:id", userController.getUserDetails);

/**
 * @route   PUT /api/admin/users/:id/block
 * @desc    Khóa/mở khóa tài khoản người dùng
 * @access  Admin
 */
router.put(
  "/:id/block",
  validate(userValidator.validateToggleUserBlock),
  userController.toggleUserBlock
);

module.exports = router;
