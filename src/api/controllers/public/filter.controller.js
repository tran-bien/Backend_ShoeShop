const asyncHandler = require("express-async-handler");
const filterService = require("@services/filter.service");

const filterController = {
  /**
   * @desc    Lấy thuộc tính lọc cho sản phẩm
   * @route   GET /api/filters/attributes
   * @access  Public
   */
  getFilterAttributes: asyncHandler(async (req, res) => {
    const result = await filterService.getFilterAttributes();
    res.json(result);
  }),

  /**
   * @desc    Lấy thuộc tính của sản phẩm
   * @route   GET /api/filters/products/:id/attributes
   * @access  Public
   */
  getProductAttributes: asyncHandler(async (req, res) => {
    const result = await filterService.getProductAttributes(req.params.id);
    res.json(result);
  }),

  /**
   * @desc    Lấy gợi ý tìm kiếm
   * @route   GET /api/filters/suggestions
   * @access  Public
   */
  getSuggestions: asyncHandler(async (req, res) => {
    const { keyword, limit = 5 } = req.query;
    const result = await filterService.getSuggestions(keyword, limit);
    res.json(result);
  }),
};

module.exports = filterController;
