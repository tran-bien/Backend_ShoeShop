const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const imageController = require("@controllers/admin/image.controller");
const uploadMiddleware = require("@middlewares/upload.middleware");
const uploadValidator = require("@validators/upload.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware auth cho tất cả routes
router.use(protect);
router.use(admin);

/**
 * @route   POST /api/admin/images/brand/:brandId/logo
 * @desc    Upload logo cho brand
 * @access  Admin
 */
router.post(
  "/brand/:brandId/logo",
  validate(uploadValidator.validateBrandId),
  uploadMiddleware.handleBrandLogoUpload,
  validate([
    uploadValidator.validateSingleFileExists,
    uploadValidator.validateImageFileType,
    uploadValidator.validateImageFileSize,
  ]),
  imageController.uploadBrandLogo
);

/**
 * @route   DELETE /api/admin/images/brand/:brandId/logo
 * @desc    Xóa logo của brand
 * @access  Admin
 */
router.delete(
  "/brand/:brandId/logo",
  validate(uploadValidator.validateBrandId),
  imageController.removeBrandLogo
);

/**
 * @route   POST /api/admin/images/product/:productId
 * @desc    Upload ảnh cho product
 * @access  Admin
 */
router.post(
  "/product/:productId",
  validate(uploadValidator.validateProductId),
  uploadMiddleware.handleProductImagesUpload,
  validate([
    uploadValidator.validateMultipleFilesExist,
    uploadValidator.validateMultipleImageFileTypes,
    uploadValidator.validateMultipleImageFileSizes,
    uploadValidator.validateMaxFileCount,
  ]),
  imageController.uploadProductImages
);

/**
 * @route   DELETE /api/admin/images/product/:productId
 * @desc    Xóa ảnh của product
 * @access  Admin
 */
router.delete(
  "/product/:productId",
  validate([
    uploadValidator.validateProductId,
    uploadValidator.validateImageIds,
  ]),
  imageController.removeProductImages
);

/**
 * @route   POST /api/admin/images/variant/:variantId
 * @desc    Upload ảnh cho variant
 * @access  Admin
 */
router.post(
  "/variant/:variantId",
  validate(uploadValidator.validateVariantId),
  uploadMiddleware.handleVariantImagesUpload,
  validate([
    uploadValidator.validateMultipleFilesExist,
    uploadValidator.validateMultipleImageFileTypes,
    uploadValidator.validateMultipleImageFileSizes,
    uploadValidator.validateMaxFileCount,
  ]),
  imageController.uploadVariantImages
);

/**
 * @route   DELETE /api/admin/images/variant/:variantId
 * @desc    Xóa ảnh của variant
 * @access  Admin
 */
router.delete(
  "/variant/:variantId",
  validate([
    uploadValidator.validateVariantId,
    uploadValidator.validateImageIds,
  ]),
  imageController.removeVariantImages
);

/**
 * @route   PUT /api/admin/images/product/:productId/reorder
 * @desc    Thay đổi thứ tự ảnh product
 * @access  Admin
 */
router.put(
  "/product/:productId/reorder",
  validate([
    uploadValidator.validateProductId,
    uploadValidator.validateImageOrders,
  ]),
  imageController.reorderProductImages
);

/**
 * @route   PUT /api/admin/images/variant/:variantId/reorder
 * @desc    Thay đổi thứ tự ảnh variant
 * @access  Admin
 */
router.put(
  "/variant/:variantId/reorder",
  validate([
    uploadValidator.validateVariantId,
    uploadValidator.validateImageOrders,
  ]),
  imageController.reorderVariantImages
);

/**
 * @route   PUT /api/admin/images/product/:productId/set-main
 * @desc    Đặt ảnh chính cho product
 * @access  Admin
 */
router.put(
  "/product/:productId/set-main",
  validate([
    uploadValidator.validateProductId,
    uploadValidator.validateMainImage,
  ]),
  imageController.setProductMainImage
);

/**
 * @route   PUT /api/admin/images/variant/:variantId/set-main
 * @desc    Đặt ảnh chính cho variant
 * @access  Admin
 */
router.put(
  "/variant/:variantId/set-main",
  validate([
    uploadValidator.validateVariantId,
    uploadValidator.validateMainImage,
  ]),
  imageController.setVariantMainImage
);

/**
 * @route   DELETE /api/admin/images/cloudinary
 * @desc    Xóa ảnh trực tiếp từ Cloudinary
 * @access  Admin
 */
router.delete(
  "/cloudinary",
  validate(uploadValidator.validateCloudinaryDelete),
  imageController.deleteFromCloudinary
);

module.exports = router;
