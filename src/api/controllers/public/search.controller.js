const asyncHandler = require("express-async-handler");
const searchService = require("@services/search.service");

const searchController = {
  /**
   * @desc    Tìm kiếm đa năng (sản phẩm hoặc biến thể)
   * @route   GET /api/search/advanced
   * @access  Public
   */
  advancedSearch: asyncHandler(async (req, res) => {
    // Truyền truy vấn trực tiếp đến service
    const result = await searchService.advancedSearch(req.query);
    res.json(result);
  }),

  /**
   * @desc    Tìm kiếm đa năng cho admin (có quyền xem cả sản phẩm inactive)
   * @route   GET /api/admin/search/advanced
   * @access  Admin
   */
  adminAdvancedSearch: asyncHandler(async (req, res) => {
    // Thêm flag admin để service biết đây là endpoint admin
    const result = await searchService.advancedSearch({
      ...req.query,
      isAdmin: true,
    });
    res.json(result);
  }),

  /**
   * @desc    Gợi ý tìm kiếm tự động
   * @route   GET /api/search/suggestions
   * @access  Public
   */
  searchSuggestions: asyncHandler(async (req, res) => {
    const { keyword, type } = req.query;
    const result = await searchService.searchSuggestions(keyword, type);
    res.json(result);
  }),

  /**
   * @desc    Tìm kiếm sản phẩm có sẵn theo kích thước và màu sắc
   * @route   GET /api/search/availability
   * @access  Public
   */
  checkAvailability: asyncHandler(async (req, res) => {
    const { productId, colorId, sizeId } = req.query;

    // Tạo query với điều kiện tìm kiếm
    const query = {
      type: "variant",
      productId,
      color: colorId,
      size: sizeId,
      inStock: "true",
      limit: 1,
    };

    const result = await searchService.advancedSearch(query);

    // Kiểm tra kết quả
    const available = result.data.length > 0;
    const variant = result.data[0] || null;

    res.json({
      success: true,
      available,
      variant: available ? variant : null,
      stock: available ? variant.totalStock : 0,
    });
  }),
};

module.exports = searchController;
