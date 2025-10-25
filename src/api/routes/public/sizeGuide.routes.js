const express = require("express");
const router = express.Router();
const sizeGuideController = require("@controllers/public/sizeGuide.controller");

/**
 * @route GET /api/products/:productId/size-guide
 * @desc Lấy size guide của sản phẩm
 * @access Public
 */
router.get("/:productId/size-guide", sizeGuideController.getProductSizeGuide);

module.exports = router;

