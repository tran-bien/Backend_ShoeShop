const express = require("express");
const router = express.Router();
const sizeGuideController = require("@controllers/admin/sizeGuide.controller");
const { protect, requireStaffOrAdmin } = require("@middlewares/auth.middleware");
const uploadMiddleware = require("@middlewares/upload.middleware");
const sizeGuideValidator = require("@validators/sizeGuide.validator");
const validateRequest = require("@middlewares/validateRequest");

router.use(protect);
router.use(requireStaffOrAdmin);

// Định nghĩa middleware upload cho size guide images
const uploadSizeGuideImage = uploadMiddleware.uploadSizeGuideImage;

/**
 * @route POST /api/admin/size-guides
 * @desc Tạo size guide mới
 */
router.post(
  "/",
  sizeGuideValidator.validateCreateSizeGuide,
  validateRequest,
  sizeGuideController.createSizeGuide
);

/**
 * @route PUT /api/admin/size-guides/:id
 * @desc Cập nhật size guide
 */
router.put(
  "/:id",
  sizeGuideValidator.validateSizeGuideId,
  sizeGuideValidator.validateUpdateSizeGuide,
  validateRequest,
  sizeGuideController.updateSizeGuide
);

/**
 * @route PUT /api/admin/size-guides/:id/size-chart-image
 * @desc Upload ảnh size chart
 */
router.put(
  "/:id/size-chart-image",
  uploadSizeGuideImage,
  sizeGuideController.updateSizeChartImage
);

/**
 * @route PUT /api/admin/size-guides/:id/measurement-image
 * @desc Upload ảnh hướng dẫn đo chân
 */
router.put(
  "/:id/measurement-image",
  uploadSizeGuideImage,
  sizeGuideController.updateMeasurementGuideImage
);

/**
 * @route DELETE /api/admin/size-guides/:id
 * @desc Xóa size guide
 */
router.delete(
  "/:id",
  sizeGuideValidator.validateSizeGuideId,
  validateRequest,
  sizeGuideController.deleteSizeGuide
);

module.exports = router;

