const asyncHandler = require("express-async-handler");
const bannerService = require("@services/banner.service");
const imageService = require("@services/image.service");

const bannerController = {
  /**
   * @route GET /api/admin/banners
   * @desc Lấy danh sách banner cho admin (có phân trang và filter)
   */
  getAllBanners: asyncHandler(async (req, res) => {
    const { page, limit, sort, search, isActive, includeDeleted } = req.query;

    const options = {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 10,
      sort,
      search,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      includeDeleted: includeDeleted === "true",
    };

    const result = await bannerService.getAllBanners(options);

    return res.json({
      success: true,
      ...result,
    });
  }),

  /**
   * @route GET /api/admin/banners/:id
   * @desc Lấy chi tiết banner theo ID
   */
  getBannerById: asyncHandler(async (req, res) => {
    const banner = await bannerService.getBannerById(req.params.id);

    return res.json({
      success: true,
      banner,
    });
  }),

  /**
   * @route POST /api/admin/banners
   * @desc Tạo banner mới (với upload ảnh)
   */
  createBanner: asyncHandler(async (req, res) => {
    const { title, displayOrder, link, isActive } = req.body;

    // Kiểm tra có file upload không
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng upload ảnh banner",
      });
    }

    const imageData = {
      url: req.file.path,
      public_id: req.file.filename,
    };

    const bannerData = {
      title,
      displayOrder: parseInt(displayOrder),
      link: link || "",
      isActive:
        isActive !== undefined
          ? isActive === "true" || isActive === true
          : true,
    };

    const result = await imageService.uploadBannerImage(imageData, bannerData);

    return res.status(201).json(result);
  }),

  /**
   * @route PUT /api/admin/banners/:id
   * @desc Cập nhật banner (không bao gồm ảnh)
   */
  updateBanner: asyncHandler(async (req, res) => {
    const { title, displayOrder, link, isActive } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (displayOrder !== undefined)
      updateData.displayOrder = parseInt(displayOrder);
    if (link !== undefined) updateData.link = link;
    if (isActive !== undefined)
      updateData.isActive = isActive === "true" || isActive === true;

    const result = await bannerService.updateBanner(req.params.id, updateData);

    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/banners/:id/image
   * @desc Cập nhật ảnh banner
   */
  updateBannerImage: asyncHandler(async (req, res) => {
    // Kiểm tra có file upload không
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng upload ảnh mới",
      });
    }

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
   */
  restoreBanner: asyncHandler(async (req, res) => {
    const { newDisplayOrder } = req.body;

    const result = await bannerService.restoreBanner(
      req.params.id,
      newDisplayOrder ? parseInt(newDisplayOrder) : null
    );

    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/banners/:id/toggle-status
   * @desc Toggle trạng thái active của banner
   */
  toggleBannerStatus: asyncHandler(async (req, res) => {
    const result = await bannerService.toggleBannerStatus(req.params.id);

    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/banners/reorder
   * @desc Sắp xếp lại thứ tự banner
   */
  reorderBanners: asyncHandler(async (req, res) => {
    const { bannerOrders } = req.body;

    // Validate dữ liệu đầu vào
    if (!Array.isArray(bannerOrders)) {
      return res.status(400).json({
        success: false,
        message: "Dữ liệu sắp xếp phải là một mảng",
      });
    }

    const result = await imageService.reorderBanners(bannerOrders);

    return res.json(result);
  }),
};

module.exports = bannerController;
