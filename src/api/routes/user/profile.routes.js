const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const profileController = require("@controllers/user/profile.controller");
const userValidator = require("@validators/user.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/users/profile
 * @desc    Lấy thông tin cá nhân
 * @access  Private
 */
router.get("/profile", protect, profileController.getUserProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Cập nhật thông tin cá nhân
 * @access  Private
 */
router.put(
  "/profile",
  protect,
  validate(userValidator.validateUpdateProfile),
  profileController.updateUserProfile
);

/**
 * @route   GET /api/users/addresses
 * @desc    Lấy danh sách địa chỉ
 * @access  Private
 */
router.get("/addresses", protect, profileController.getUserAddresses);

/**
 * @route   POST /api/users/addresses
 * @desc    Thêm địa chỉ mới
 * @access  Private
 */
router.post(
  "/addresses",
  protect,
  validate(userValidator.validateAddAddress),
  profileController.addUserAddress
);

/**
 * @route   PUT /api/users/addresses/:id
 * @desc    Cập nhật địa chỉ
 * @access  Private
 */
router.put(
  "/addresses/:id",
  protect,
  validate(userValidator.validateUpdateAddress),
  profileController.updateUserAddress
);

/**
 * @route   DELETE /api/users/addresses/:id
 * @desc    Xóa địa chỉ
 * @access  Private
 */
router.delete("/addresses/:id", protect, profileController.deleteUserAddress);

/**
 * @route   PUT /api/users/addresses/:id/default
 * @desc    Đặt địa chỉ mặc định
 * @access  Private
 */
router.put(
  "/addresses/:id/default",
  protect,
  profileController.setDefaultAddress
);

module.exports = router;
