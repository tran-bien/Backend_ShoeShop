const asyncHandler = require("express-async-handler");
const sizeGuideService = require("@services/sizeGuide.service");
const imageService = require("@services/image.service");
const { processCloudinaryUpload } = require("@middlewares/upload.middleware");

const sizeGuideController = {
  /**
   * @route GET /api/admin/size-guides
   * @desc Lấy danh sách size guides
   * @access Staff/Admin
   */
  getAllSizeGuides: asyncHandler(async (req, res) => {
    const result = await sizeGuideService.getAllSizeGuides(req.query);
    return res.json(result);
  }),

  /**
   * @route GET /api/admin/size-guides/:id
   * @desc Lấy chi tiết size guide
   * @access Staff/Admin
   */
  getSizeGuideById: asyncHandler(async (req, res) => {
    const result = await sizeGuideService.getSizeGuideById(req.params.id);
    return res.json(result);
  }),

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
    // Upload to Cloudinary after validation
    await processCloudinaryUpload(req);

    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const result = await imageService.updateSizeChartImage(
      req.params.id,
      imageData
    );

    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/size-guides/:id/measurement-image
   * @desc Upload/cập nhật ảnh hướng dẫn đo chân
   * @access Staff/Admin
   */
  updateMeasurementGuideImage: asyncHandler(async (req, res) => {
    // Upload to Cloudinary after validation
    await processCloudinaryUpload(req);

    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const result = await imageService.updateMeasurementGuideImage(
      req.params.id,
      imageData
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
