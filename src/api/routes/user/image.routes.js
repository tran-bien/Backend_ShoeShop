const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const userImageController = require("@controllers/user/image.controller");
const {
  userAvatarMiddleware,
  reviewImageMiddleware,
} = require("@middlewares/image/image-routes.middleware");

const router = express.Router();

/**
 * @route   POST /api/images/avatar
 * @desc    Upload ảnh đại diện cho chính mình
 * @access  Private
 */
router.post(
  "/avatar",
  protect,
  userAvatarMiddleware.upload,
  userImageController.uploadAvatar
);

/**
 * @route   DELETE /api/images/avatar
 * @desc    Xóa ảnh đại diện của chính mình
 * @access  Private
 */
router.delete(
  "/avatar",
  protect,
  userAvatarMiddleware.remove,
  userImageController.removeAvatar
);

/**
 * @route   POST /api/images/review/:reviewId
 * @desc    Upload ảnh cho review
 * @access  Private
 */
router.post(
  "/review/:reviewId",
  protect,
  reviewImageMiddleware.upload,
  userImageController.uploadReviewImages
);

/**
 * @route   DELETE /api/images/review/:reviewId
 * @desc    Xóa ảnh của review
 * @access  Private
 */
router.delete(
  "/review/:reviewId",
  protect,
  reviewImageMiddleware.remove,
  userImageController.removeReviewImages
);

module.exports = router;
