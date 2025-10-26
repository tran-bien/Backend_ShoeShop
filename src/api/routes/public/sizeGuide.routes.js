const express = require("express");
const router = express.Router();
const sizeGuideController = require("@controllers/public/sizeGuide.controller");
const sizeGuideValidator = require("@validators/sizeGuide.validator");
const validateRequest = require("@middlewares/validateRequest");

/**
 * @route GET /api/products/:productId/size-guide
 * @desc Lấy size guide của sản phẩm
 * @access Public
 */
router.get(
  "/:productId/size-guide",
  sizeGuideValidator.validateProductId,
  validateRequest,
  sizeGuideController.getProductSizeGuide
);

module.exports = router;

