const asyncHandler = require("express-async-handler");
const bannerService = require("@services/banner.service");
const imageService = require("@services/image.service");
const { processCloudinaryUpload } = require("@middlewares/upload.middleware");

const bannerController = {
  /**
   * @route GET /api/admin/banners
   * @desc Lấy danh sách banner cho admin (có phân trang và filter)
   * @access Staff/Admin
   */
  getAllBanners: asyncHandler(async (req, res) => {
    const result = await bannerService.getAllBanners(req.query);
    return res.json(result);
  }),

  /**
   * @route GET /api/admin/banners/:id
   * @desc Lấy chi tiết banner theo ID
   * @access Staff/Admin
   */
  getBannerById: asyncHandler(async (req, res) => {
    const result = await bannerService.getBannerById(req.params.id);
    return res.json(result);
  }),

  /**
   * @route POST /api/admin/banners
   * @desc Tạo banner mới (với upload ảnh)
   * @access Staff/Admin
   */
  createBanner: asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng upload ảnh banner",
      });
    }

    // Upload to Cloudinary after validation
    await processCloudinaryUpload(req);

    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const bannerData = {
      title: req.body.title,
      displayOrder: parseInt(req.body.displayOrder),
      link: req.body.link || "",
      isActive:
        req.body.isActive !== undefined
          ? req.body.isActive === "true" || req.body.isActive === true
          : true,
    };

    const result = await imageService.uploadBannerImage(imageData, bannerData);
    return res.status(201).json(result);
  }),

  /**
   * @route PUT /api/admin/banners/:id
   * @desc Cập nhật banner (không bao gồm ảnh)
   * @access Staff/Admin
   */
  updateBanner: asyncHandler(async (req, res) => {
    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.displayOrder !== undefined)
      updateData.displayOrder = parseInt(req.body.displayOrder);
    if (req.body.link !== undefined) updateData.link = req.body.link;
    if (req.body.isActive !== undefined)
      updateData.isActive =
        req.body.isActive === "true" || req.body.isActive === true;

    const result = await bannerService.updateBanner(req.params.id, updateData);
    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/banners/:id/image
   * @desc Cập nhật ảnh banner
   * @access Staff/Admin
   */
  updateBannerImage: asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng upload ảnh mới",
      });
    }

    // Upload to Cloudinary after validation
    await processCloudinaryUpload(req);

    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const result = await imageService.updateBannerImage(
      req.params.id,
      imageData
    );
    return res.json(result);
  }),

  /**
   * @route DELETE /api/admin/banners/:id
   * @desc Xóa mềm banner
   * @access Staff/Admin
   */
  deleteBanner: asyncHandler(async (req, res) => {
    const result = await imageService.deleteBannerImage(
      req.params.id,
      req.user._id
    );
    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/banners/:id/restore
   * @desc Khôi phục banner đã xóa
   * @access Staff/Admin
   */
  restoreBanner: asyncHandler(async (req, res) => {
    const newDisplayOrder = req.body.newDisplayOrder
      ? parseInt(req.body.newDisplayOrder)
      : null;

    const result = await bannerService.restoreBanner(
      req.params.id,
      newDisplayOrder
    );
    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/banners/:id/toggle-status
   * @desc Toggle trạng thái active của banner
   * @access Staff/Admin
   */
  toggleBannerStatus: asyncHandler(async (req, res) => {
    const result = await bannerService.toggleBannerStatus(req.params.id);
    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/banners/reorder
   * @desc Sắp xếp lại thứ tự banner
   * @access Staff/Admin
   */
  reorderBanners: asyncHandler(async (req, res) => {
    if (!Array.isArray(req.body.bannerOrders)) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu sắp xếp phải là một mảng",
      });
    }

    const result = await imageService.reorderBanners(req.body.bannerOrders);
    return res.json(result);
  }),
};

module.exports = bannerController;
