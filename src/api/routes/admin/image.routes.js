const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const imageController = require("@controllers/admin/image.controller");
const uploadMiddleware = require("@middlewares/upload.middleware");
const uploadValidator = require("@validators/upload.validator");
const { validateRequest } = require("@middlewares/validateRequest");

const router = express.Router();

/**
 * @route   POST /api/admin/images/brand/:brandId/logo
 * @desc    Upload logo cho brand
 * @access  Admin
 */
router.post(
  "/brand/:brandId/logo",
  protect,
  admin,
  uploadValidator.validateBrandId,
  validateRequest,
  uploadMiddleware.handleBrandLogoUpload,
  uploadValidator.validateSingleFileExists,
  uploadValidator.validateImageFileType,
  uploadValidator.validateImageFileSize,
  validateRequest,
  imageController.uploadBrandLogo
);

/**
 * @route   DELETE /api/admin/images/brand/:brandId/logo
 * @desc    Xóa logo của brand
 * @access  Admin
 */
router.delete(
  "/brand/:brandId/logo",
  protect,
  admin,
  uploadValidator.validateBrandId,
  validateRequest,
  imageController.removeBrandLogo
);

/**
 * @route   POST /api/admin/images/product/:productId
 * @desc    Upload ảnh cho product
 * @access  Admin
 */
router.post(
  "/product/:productId",
  protect,
  admin,
  uploadValidator.validateProductId,
  validateRequest,
  uploadMiddleware.handleProductImagesUpload,
  uploadValidator.validateMultipleFilesExist,
  uploadValidator.validateMultipleImageFileTypes,
  uploadValidator.validateMultipleImageFileSizes,
  uploadValidator.validateMaxFileCount,
  validateRequest,
  imageController.uploadProductImages
);

/**
 * @route   DELETE /api/admin/images/product/:productId
 * @desc    Xóa ảnh của product
 * @access  Admin
 */
router.delete(
  "/product/:productId",
  protect,
  admin,
  uploadValidator.validateProductId,
  uploadValidator.validateImageIds,
  validateRequest,
  imageController.removeProductImages
);

/**
 * @route   POST /api/admin/images/variant/:variantId
 * @desc    Upload ảnh cho variant
 * @access  Admin
 */
router.post(
  "/variant/:variantId",
  protect,
  admin,
  uploadValidator.validateVariantId,
  validateRequest,
  uploadMiddleware.handleVariantImagesUpload,
  uploadValidator.validateMultipleFilesExist,
  uploadValidator.validateMultipleImageFileTypes,
  uploadValidator.validateMultipleImageFileSizes,
  uploadValidator.validateMaxFileCount,
  validateRequest,
  imageController.uploadVariantImages
);

/**
 * @route   DELETE /api/admin/images/variant/:variantId
 * @desc    Xóa ảnh của variant
 * @access  Admin
 */
router.delete(
  "/variant/:variantId",
  protect,
  admin,
  uploadValidator.validateVariantId,
  uploadValidator.validateImageIds,
  validateRequest,
  imageController.removeVariantImages
);

/**
 * @route   PUT /api/admin/images/product/:productId/reorder
 * @desc    Thay đổi thứ tự ảnh product
 * @access  Admin
 */
router.put(
  "/product/:productId/reorder",
  protect,
  admin,
  uploadValidator.validateProductId,
  uploadValidator.validateImageOrders,
  validateRequest,
  imageController.reorderProductImages
);

/**
 * @route   PUT /api/admin/images/variant/:variantId/reorder
 * @desc    Thay đổi thứ tự ảnh variant
 * @access  Admin
 */
router.put(
  "/variant/:variantId/reorder",
  protect,
  admin,
  uploadValidator.validateVariantId,
  uploadValidator.validateImageOrders,
  validateRequest,
  imageController.reorderVariantImages
);

/**
 * @route   PUT /api/admin/images/product/:productId/set-main
 * @desc    Đặt ảnh chính cho product
 * @access  Admin
 */
router.put(
  "/product/:productId/set-main",
  protect,
  admin,
  uploadValidator.validateProductId,
  uploadValidator.validateMainImage,
  validateRequest,
  imageController.setProductMainImage
);

/**
 * @route   PUT /api/admin/images/variant/:variantId/set-main
 * @desc    Đặt ảnh chính cho variant
 * @access  Admin
 */
router.put(
  "/variant/:variantId/set-main",
  protect,
  admin,
  uploadValidator.validateVariantId,
  uploadValidator.validateMainImage,
  validateRequest,
  imageController.setVariantMainImage
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
  uploadValidator.validateCloudinaryDelete,
  validateRequest,
  imageController.deleteFromCloudinary
);

module.exports = router;
