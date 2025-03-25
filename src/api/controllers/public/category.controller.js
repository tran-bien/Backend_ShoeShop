const asyncHandler = require("express-async-handler");
const categoryService = require("@services/category.service");

const categoryController = {
  /**
   * @route GET /api/categories
   * @desc Lấy danh sách danh mục (chỉ lấy active và không xóa)
   */
  getAllCategories: asyncHandler(async (req, res) => {
    // Chỉ lấy các danh mục active
    req.query.isActive = true;
    const result = await categoryService.getAllCategories(req.query);
    return res.json(result);
  }),

  /**
   * @route GET /api/categories/:id
   * @desc Lấy chi tiết danh mục theo ID
   */
  getCategoryById: asyncHandler(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.id);

    // Kiểm tra thêm xem danh mục có đang active không
    if (!category.isActive) {
      res.status(404);
      throw new Error("Không tìm thấy danh mục");
    }

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
