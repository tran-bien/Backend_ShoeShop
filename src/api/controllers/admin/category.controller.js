const asyncHandler = require("express-async-handler");
const categoryService = require("@services/category.service");

const categoryController = {
  /**
   * @route GET /api/admin/categories
   * @desc Lấy danh sách danh mục (kể cả không active)
   */
  getAllCategories: asyncHandler(async (req, res) => {
    const result = await categoryService.getAdminAllCategories(req.query);
    return res.json(result);
  }),

  /**
   * @route GET /api/admin/categories/:id
   * @desc Lấy chi tiết danh mục theo ID
   */
  getCategoryById: asyncHandler(async (req, res) => {
    const category = await categoryService.getAdminCategoryById(req.params.id);
    return res.json({
      success: true,
      category,
    });
  }),

  /**
   * @route POST /api/admin/categories
   * @desc Tạo mới danh mục
   */
  createCategory: asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body);
    return res.status(201).json({
      success: true,
      message: "Tạo danh mục thành công",
      category,
    });
  }),

  /**
   * @route PUT /api/admin/categories/:id
   * @desc Cập nhật danh mục
   */
  updateCategory: asyncHandler(async (req, res) => {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.body
    );
    return res.json({
      success: true,
      message: "Cập nhật danh mục thành công",
      category,
    });
  }),

  /**
   * @route DELETE /api/admin/categories/:id
   * @desc Xóa mềm danh mục
   */
  deleteCategory: asyncHandler(async (req, res) => {
    const result = await categoryService.deleteCategory(
      req.params.id,
      req.user._id
    );
    return res.json({
      success: true,
      message: result.message,
    });
  }),

  /**
   * @route GET /api/admin/categories/deleted
   * @desc Lấy danh sách danh mục đã xóa
   */
  getDeletedCategories: asyncHandler(async (req, res) => {
    const result = await categoryService.getDeletedCategories(req.query);
    return res.json(result);
  }),

  /**
   * @route PUT /api/admin/categories/:id/restore
   * @desc Khôi phục danh mục đã xóa
   */
  restoreCategory: asyncHandler(async (req, res) => {
    const result = await categoryService.restoreCategory(req.params.id);
    return res.json({
      success: true,
      message: result.message,
      category: result.category,
    });
  }),

  /**
   * @route PATCH /api/admin/categories/:id/status
   * @desc Cập nhật trạng thái active của danh mục
   */
  updateCategoryStatus: asyncHandler(async (req, res) => {
    const { isActive, cascade = true } = req.body;

    const result = await categoryService.updateCategoryStatus(
      req.params.id,
      isActive,
      cascade
    );

    return res.json({
      success: true,
      message: result.message,
      category: result.category,
    });
  }),
};

module.exports = categoryController;
