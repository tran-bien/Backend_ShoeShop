const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const adminImageController = require("@controllers/admin/image.controller");
const {
  adminUserAvatarMiddleware,
  adminModelImageMiddleware,
} = require("@middlewares/image/image-routes.middleware");

const router = express.Router();

/**
 * @route   POST /api/admin/images/user/:userId/avatar
 * @desc    Upload ảnh đại diện cho một người dùng (bởi admin)
 * @access  Admin
 */
router.post(
  "/user/:userId/avatar",
  protect,
  admin,
  adminUserAvatarMiddleware.upload,
  adminImageController.uploadUserAvatar
);

/**
 * @route   DELETE /api/admin/images/user/:userId/avatar
 * @desc    Xóa ảnh đại diện của một người dùng (bởi admin)
 * @access  Admin
 */
router.delete(
  "/user/:userId/avatar",
  protect,
  admin,
  adminUserAvatarMiddleware.remove,
  adminImageController.removeUserAvatar
);

/**
 * @route   POST /api/admin/images/:modelType/:modelId
 * @desc    Upload ảnh cho model (product, variant, brand)
 * @access  Admin
 */
router.post(
  "/:modelType/:modelId",
  protect,
  admin,
  adminModelImageMiddleware.upload,
  adminImageController.uploadModelImages
);

/**
 * @route   DELETE /api/admin/images/:modelType/:modelId
 * @desc    Xóa ảnh của model
 * @access  Admin
 */
router.delete(
  "/:modelType/:modelId",
  protect,
  admin,
  adminModelImageMiddleware.remove,
  adminImageController.removeModelImages
);

/**
 * @route   PUT /api/admin/images/reorder/:modelType/:modelId
 * @desc    Thay đổi thứ tự ảnh
 * @access  Admin
 */
router.put(
  "/reorder/:modelType/:modelId",
  protect,
  admin,
  adminModelImageMiddleware.reorder,
  adminImageController.reorderImages
);

/**
 * @route   PUT /api/admin/images/set-main/:modelType/:modelId
 * @desc    Đặt ảnh chính
 * @access  Admin
 */
router.put(
  "/set-main/:modelType/:modelId",
  protect,
  admin,
  adminModelImageMiddleware.setMain,
  adminImageController.setMainImage
);

/**
 * @route   DELETE /api/admin/images/cloudinary
 * @desc    Xóa ảnh trực tiếp từ Cloudinary
 * @access  Admin
 */
router.delete(
  "/cloudinary",
  protect,
  admin,
  adminModelImageMiddleware.cloudinaryDelete,
  adminImageController.deleteFromCloudinary
);

module.exports = router;
