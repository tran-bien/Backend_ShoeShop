const blogCategoryService = require("@services/blogCategory.service");

const blogCategoryController = {
  /**
   * [PUBLIC] GET /api/v1/blogs/categories
   */
  getAllCategories: async (req, res, next) => {
    try {
      const result = await blogCategoryService.getAllCategories(req.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] GET /api/v1/admin/blogs/categories
   */
  getAdminCategories: async (req, res, next) => {
    try {
      const result = await blogCategoryService.getAdminCategories(req.query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [PUBLIC/ADMIN] GET /api/v1/blogs/categories/:id
   */
  getCategoryById: async (req, res, next) => {
    try {
      const category = await blogCategoryService.getCategoryById(req.params.id);
      res.json(category);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] POST /api/v1/admin/blogs/categories
   */
  createCategory: async (req, res, next) => {
    try {
      const category = await blogCategoryService.createCategory(req.body);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] PUT /api/v1/admin/blogs/categories/:id
   */
  updateCategory: async (req, res, next) => {
    try {
      const category = await blogCategoryService.updateCategory(
        req.params.id,
        req.body
      );
      res.json(category);
    } catch (error) {
      next(error);
    }
  },

  /**
   * [ADMIN] DELETE /api/v1/admin/blogs/categories/:id
   */
  deleteCategory: async (req, res, next) => {
    try {
      const result = await blogCategoryService.deleteCategory(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};

module.exports = blogCategoryController;
