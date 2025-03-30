const asyncHandler = require("express-async-handler");
const sizeService = require("@services/size.service");

const sizeController = {
  /**
   * @desc    Lấy danh sách tất cả kích thước (public)
   * @route   GET /api/sizes
   * @access  Public
   */
  getAllSizes: asyncHandler(async (req, res) => {
    const result = await sizeService.getPublicSizes(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy thông tin chi tiết kích thước theo ID
   * @route   GET /api/sizes/:id
   * @access  Public
   */
  getSizeById: asyncHandler(async (req, res) => {
    const result = await sizeService.getPublicSizeById(req.params.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  }),
};

module.exports = sizeController;
