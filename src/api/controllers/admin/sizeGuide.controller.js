const asyncHandler = require("express-async-handler");
const sizeGuideService = require("@services/sizeGuide.service");

const sizeGuideController = {
  /**
   * @route POST /api/admin/size-guides
   * @desc Tạo size guide cho sản phẩm
   * @access Staff/Admin
   */
  createSizeGuide: asyncHandler(async (req, res) => {
    const result = await sizeGuideService.createSizeGuide(
      req.body.productId,
      req.body,
      req.user._id
    );

    return res.status(201).json(result);
  }),

  /**
   * @route PUT /api/admin/size-guides/:id
   * @desc Cập nhật size guide
   * @access Staff/Admin
   */
  updateSizeGuide: asyncHandler(async (req, res) => {
    const result = await sizeGuideService.updateSizeGuide(
      req.params.id,
      req.body,
      req.user._id
    );

    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/size-guides/:id/size-chart-image
   * @desc Upload/cập nhật ảnh size chart
   * @access Staff/Admin
   */
  updateSizeChartImage: asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng upload ảnh",
      });
    }

    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const result = await sizeGuideService.updateSizeChartImage(
      req.params.id,
      imageData,
      req.user._id
    );

    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/size-guides/:id/measurement-image
   * @desc Upload/cập nhật ảnh hướng dẫn đo chân
   * @access Staff/Admin
   */
  updateMeasurementGuideImage: asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng upload ảnh",
      });
    }

    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const result = await sizeGuideService.updateMeasurementGuideImage(
      req.params.id,
      imageData,
      req.user._id
    );

    return res.json(result);
  }),

  /**
   * @route DELETE /api/admin/size-guides/:id
   * @desc Xóa size guide
   * @access Staff/Admin
   */
  deleteSizeGuide: asyncHandler(async (req, res) => {
    const result = await sizeGuideService.deleteSizeGuide(
      req.params.id,
      req.user._id
    );

    return res.json(result);
  }),
};

module.exports = sizeGuideController;

