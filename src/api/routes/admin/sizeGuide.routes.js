const express = require("express");
const router = express.Router();
const sizeGuideController = require("@controllers/admin/sizeGuide.controller");
const { protect, requireStaffOrAdmin } = require("@middlewares/auth.middleware");
const uploadMiddleware = require("@middlewares/upload.middleware");

router.use(protect);
router.use(requireStaffOrAdmin);

// Tạo middleware upload cho size guide images
const uploadSizeGuideImage = uploadMiddleware.uploadBannerImage; // Tái sử dụng middleware có sẵn

/**
 * @route POST /api/admin/size-guides
 * @desc Tạo size guide mới
 */
router.post("/", sizeGuideController.createSizeGuide);

/**
 * @route PUT /api/admin/size-guides/:id
 * @desc Cập nhật size guide
 */
router.put("/:id", sizeGuideController.updateSizeGuide);

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
router.delete("/:id", sizeGuideController.deleteSizeGuide);

module.exports = router;

