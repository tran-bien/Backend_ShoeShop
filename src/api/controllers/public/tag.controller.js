const asyncHandler = require("express-async-handler");
const tagService = require("@services/tag.service");

const tagController = {
  /**
   * @desc    Lấy tất cả tags đang active (cho user)
   * @route   GET /api/v1/tags
   * @access  Public
   */
  getAllTags: asyncHandler(async (req, res) => {
    // Chỉ lấy tags đang active và chưa bị xóa
    const query = {
      ...req.query,
      isActive: true, // Force active only
    };
    const result = await tagService.getAllTags(query);
    res.status(200).json(result);
  }),

  /**
   * @desc    Lấy tags theo type (MATERIAL/USECASE/CUSTOM)
   * @route   GET /api/v1/tags/type/:type
   * @access  Public
   */
  getTagsByType: asyncHandler(async (req, res) => {
    const { type } = req.params;

    // Validate type
    const validTypes = ["MATERIAL", "USECASE", "CUSTOM"];
    if (!validTypes.includes(type.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: "Type không hợp lệ. Chỉ chấp nhận: MATERIAL, USECASE, CUSTOM",
      });
    }

    const query = {
      ...req.query,
      type: type.toUpperCase(),
      isActive: true, // Chỉ lấy tags active
    };

    const result = await tagService.getAllTags(query);
    res.status(200).json(result);
  }),

  /**
   * @desc    Lấy chi tiết tag theo ID (cho user)
   * @route   GET /api/v1/tags/:id
   * @access  Public
   */
  getTagById: asyncHandler(async (req, res) => {
    const result = await tagService.getTagById(req.params.id);

    // Kiểm tra tag có active không
    if (!result.tag.isActive) {
      return res.status(404).json({
        success: false,
        message: "Tag không tồn tại hoặc đã bị vô hiệu hóa",
      });
    }

    res.status(200).json(result);
  }),
};

module.exports = tagController;
