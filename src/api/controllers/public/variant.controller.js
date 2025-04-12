const asyncHandler = require("express-async-handler");
const variantService = require("@services/variant.service");

const variantController = {
  /**
   * @desc    Lấy tổng quan tồn kho của biến thể
   * @route   GET /api/variants/:id/inventory
   * @access  Public
   */
  getVariantInventory: asyncHandler(async (req, res) => {
    const result = await variantService.getVariantInventorySummary(
      req.params.id
    );
    res.json(result);
  }),

  /**
   * @desc    Lấy biến thể theo sản phẩm, màu sắc và kích thước
   * @route   GET /api/variants/product/:productId
   * @access  Public
   */
  getVariantByCriteria: asyncHandler(async (req, res) => {
    const { productId } = req.params;
    const { colorId, sizeId } = req.query;

    const result = await variantService.getVariantByCriteria({
      productId,
      colorId,
      sizeId,
    });

    res.json(result);
  }),
};

module.exports = variantController;
