const asyncHandler = require("express-async-handler");
const brandService = require("../../services/brand.service");

/**
 * @desc    Lấy tất cả thương hiệu cho người dùng
 * @route   GET /api/brands
 * @access  Public
 */
exports.getAllBrandsForUser = asyncHandler(async (req, res) => {
  try {
    const brands = await brandService.getBrandsForUser();
    res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thương hiệu",
    });
  }
});

/**
 * @desc    Lấy thương hiệu theo slug cho người dùng
 * @route   GET /api/brands/slug/:slug
 * @access  Public
 */
exports.getBrandBySlugForUser = asyncHandler(async (req, res) => {
  try {
    const brand = await brandService.getBrandBySlugForUser(req.params.slug);
    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thương hiệu theo slug",
    });
  }
});
