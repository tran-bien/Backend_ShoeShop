const express = require("express");
const router = express.Router();
const sizeGuideController = require("@controllers/admin/sizeGuide.controller");
const {
  protect,
  requireStaffOrAdmin,
} = require("@middlewares/auth.middleware");
const uploadMiddleware = require("@middlewares/upload.middleware");
const sizeGuideValidator = require("@validators/sizeGuide.validator");
const uploadValidator = require("@validators/upload.validator");
const validate = require("@utils/validatehelper");

router.use(protect);
router.use(requireStaffOrAdmin);

// Định nghĩa middleware upload cho size guide images
const uploadSizeGuideImage = uploadMiddleware.uploadSizeGuideImage;

/**
 * @route GET /api/admin/size-guides
 * @desc Lấy danh sách size guides
 */
router.get("/", sizeGuideController.getAllSizeGuides);

/**
 * @route GET /api/admin/size-guides/:id
 * @desc Lấy chi tiết size guide
 */
router.get(
  "/:id",
  validate(sizeGuideValidator.validateSizeGuideId),
  sizeGuideController.getSizeGuideById
);

/**
 * @route POST /api/admin/size-guides
 * @desc Tạo size guide mới
 */
router.post(
  "/",
  validate(sizeGuideValidator.validateCreateSizeGuide),
  sizeGuideController.createSizeGuide
);

/**
 * @route PUT /api/admin/size-guides/:id
 * @desc Cập nhật size guide
 */
router.put(
  "/:id",
  validate([
    sizeGuideValidator.validateSizeGuideId,
    sizeGuideValidator.validateUpdateSizeGuide,
  ]),
  sizeGuideController.updateSizeGuide
);

/**
 * @route PUT /api/admin/size-guides/:id/size-chart-image
 * @desc Upload ảnh size chart
 */
router.put(
  "/:id/size-chart-image",
  validate(sizeGuideValidator.validateSizeGuideId),
  uploadSizeGuideImage,
  validate([
    uploadValidator.validateSingleFileExists,
    uploadValidator.validateImageFileType,
    uploadValidator.validateImageFileSize,
  ]),
  sizeGuideController.updateSizeChartImage
);

/**
 * @route PUT /api/admin/size-guides/:id/measurement-image
 * @desc Upload ảnh hướng dẫn đo chân
 */
router.put(
  "/:id/measurement-image",
  validate(sizeGuideValidator.validateSizeGuideId),
  uploadSizeGuideImage,
  validate([
    uploadValidator.validateSingleFileExists,
    uploadValidator.validateImageFileType,
    uploadValidator.validateImageFileSize,
  ]),
  sizeGuideController.updateMeasurementGuideImage
);

/**
 * @route DELETE /api/admin/size-guides/:id
 * @desc Xóa size guide
 */
router.delete(
  "/:id",
  validate(sizeGuideValidator.validateSizeGuideId),
  sizeGuideController.deleteSizeGuide
);

module.exports = router;
