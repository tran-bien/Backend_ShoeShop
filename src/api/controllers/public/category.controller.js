const asyncHandler = require("express-async-handler");
const categoryService = require("@services/category.service");

const categoryController = {
  /**
   * @route GET /api/categories
   * @desc Lấy danh sách danh mục (chỉ lấy active và không xóa)
   */
  getAllCategories: asyncHandler(async (req, res) => {
    const result = await categoryService.getPublicAllCategories(req.query);
    return res.json(result);
  }),

  /**
   * @route GET /api/categories/:id
   * @desc Lấy chi tiết danh mục theo ID
   */
  getCategoryById: asyncHandler(async (req, res) => {
    const category = await categoryService.getPublicCategoryById(req.params.id);
    return res.json({
      success: true,
      category,
    });
  }),

  /**
   * @route GET /api/categories/slug/:slug
   * @desc Lấy chi tiết danh mục theo slug
   */
  getCategoryBySlug: asyncHandler(async (req, res) => {
    const category = await categoryService.getCategoryBySlug(req.params.slug);
    return res.json({
      success: true,
      category,
    });
  }),
};

module.exports = categoryController;
