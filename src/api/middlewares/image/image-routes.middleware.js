const { validateRequest } = require("@middlewares/validateRequest");
const {
  checkReviewOwnership,
} = require("@middlewares/image/review-ownership.middleware");
const uploadMiddleware = require("@middlewares/image/upload.middleware");
const modelCheckMiddleware = require("@middlewares/image/model-check.middleware");
const imageValidator = require("@validators/image.validator");

/**
 * Middleware tổng hợp cho xử lý review
 */
exports.reviewImageMiddleware = {
  // Middleware upload ảnh review
  upload: [
    imageValidator.validateReviewIdParam,
    validateRequest,
    checkReviewOwnership,
    uploadMiddleware.handleReviewImageUpload,
    imageValidator.validateReviewImages,
    validateRequest,
    modelCheckMiddleware.setReviewModelType,
  ],

  // Middleware xóa ảnh review
  remove: [
    imageValidator.validateReviewIdParam,
    validateRequest,
    checkReviewOwnership,
    imageValidator.validateRemoveImages,
    validateRequest,
    modelCheckMiddleware.setReviewModelType,
  ],
};

/**
 * Middleware tổng hợp cho user avatar
 */
exports.userAvatarMiddleware = {
  // Middleware upload avatar
  upload: [uploadMiddleware.handleAvatarUpload],

  // Middleware xóa avatar
  remove: [],
};

/**
 * Middleware tổng hợp cho admin quản lý avatar user
 */
exports.adminUserAvatarMiddleware = {
  // Middleware upload avatar cho user (by admin)
  upload: [
    imageValidator.validateUserIdParam,
    validateRequest,
    uploadMiddleware.handleAvatarUpload,
  ],

  // Middleware xóa avatar user (by admin)
  remove: [imageValidator.validateUserIdParam, validateRequest],
};

/**
 * Middleware tổng hợp cho admin quản lý ảnh model
 */
exports.adminModelImageMiddleware = {
  // Middleware upload ảnh model
  upload: [
    imageValidator.validateUploadImages,
    validateRequest,
    modelCheckMiddleware.ensureNotReviewModel,
    uploadMiddleware.chooseUploadMiddlewareByModelType,
  ],

  // Middleware xóa ảnh model
  remove: [
    imageValidator.validateRemoveImages,
    validateRequest,
    modelCheckMiddleware.ensureNotReviewModel,
  ],

  // Middleware sắp xếp ảnh
  reorder: [imageValidator.validateReorderImages, validateRequest],

  // Middleware đặt ảnh chính
  setMain: [imageValidator.validateSetMainImage, validateRequest],

  // Middleware xóa ảnh từ Cloudinary
  cloudinaryDelete: [
    imageValidator.validateDeleteFromCloudinary,
    validateRequest,
  ],
};
