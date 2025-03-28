const asyncHandler = require("express-async-handler");
const colorService = require("@services/color.service");

const colorController = {
  /**
   * @desc    Lấy danh sách tất cả màu sắc (public)
   * @route   GET /api/colors
   * @access  Public
   */
  getAllColors: asyncHandler(async (req, res) => {
    const result = await colorService.getColors(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy thông tin chi tiết màu sắc theo ID
   * @route   GET /api/colors/:id
   * @access  Public
   */
  getColorById: asyncHandler(async (req, res) => {
    const result = await colorService.getColorById(req.params.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  }),
};

module.exports = colorController;
