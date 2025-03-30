const asyncHandler = require("express-async-handler");
const colorService = require("@services/color.service");

const colorController = {
  /**
   * @desc    Lấy danh sách tất cả màu sắc (admin)
   * @route   GET /api/admin/colors
   * @access  Admin
   */
  getAllColors: asyncHandler(async (req, res) => {
    const result = await colorService.getAdminColors(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy danh sách màu sắc đã xóa
   * @route   GET /api/admin/colors/deleted
   * @access  Admin
   */
  getDeletedColors: asyncHandler(async (req, res) => {
    const result = await colorService.getDeletedColors(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy thông tin chi tiết màu sắc theo ID
   * @route   GET /api/admin/colors/:id
   * @access  Admin
   */
  getColorById: asyncHandler(async (req, res) => {
    const result = await colorService.getAdminColorById(req.params.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  }),

  /**
   * @desc    Tạo màu sắc mới
   * @route   POST /api/admin/colors
   * @access  Admin
   */
  createColor: asyncHandler(async (req, res) => {
    const result = await colorService.createColor(req.body);

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  }),

  /**
   * @desc    Cập nhật màu sắc
   * @route   PUT /api/admin/colors/:id
   * @access  Admin
   */
  updateColor: asyncHandler(async (req, res) => {
    const result = await colorService.updateColor(req.params.id, req.body);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  }),

  /**
   * @desc    Xóa màu sắc (soft delete)
   * @route   DELETE /api/admin/colors/:id
   * @access  Admin
   */
  deleteColor: asyncHandler(async (req, res) => {
    const result = await colorService.deleteColor(req.params.id, req.user._id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  }),

  /**
   * @desc    Khôi phục màu sắc đã xóa
   * @route   PUT /api/admin/colors/:id/restore
   * @access  Admin
   */
  restoreColor: asyncHandler(async (req, res) => {
    const result = await colorService.restoreColor(req.params.id);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  }),
};

module.exports = colorController;
