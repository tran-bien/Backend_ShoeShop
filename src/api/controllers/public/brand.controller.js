const asyncHandler = require("express-async-handler");
const brandService = require("@services/brand.service");

const brandController = {
  /**
   * @route GET /api/brands
   * @desc Lấy danh sách thương hiệu (chỉ lấy active và không xóa)
   */
  getAllBrands: asyncHandler(async (req, res) => {
    // Chỉ lấy các thương hiệu active
    req.query.isActive = true;
    const result = await brandService.getAllBrands(req.query);
    return res.json(result);
  }),

  /**
   * @route GET /api/brands/:id
   * @desc Lấy chi tiết thương hiệu theo ID
   */
  getBrandById: asyncHandler(async (req, res) => {
    const brand = await brandService.getBrandById(req.params.id);

    // Kiểm tra thêm xem thương hiệu có đang active không
    if (!brand.isActive) {
      res.status(404);
      throw new Error("Không tìm thấy thương hiệu");
    }

    return res.json({
      success: true,
      brand,
    });
  }),

  /**
   * @route GET /api/brands/slug/:slug
   * @desc Lấy chi tiết thương hiệu theo slug
   */
  getBrandBySlug: asyncHandler(async (req, res) => {
    const brand = await brandService.getBrandBySlug(req.params.slug);
    return res.json({
      success: true,
      brand,
    });
  }),
};

module.exports = brandController;
