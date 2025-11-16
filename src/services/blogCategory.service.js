const BlogCategory = require("../models/blogCategory");
const { createSlug } = require("@utils/slugify");
const paginate = require("@utils/pagination");
const ApiError = require("@utils/ApiError");

const blogCategoryService = {
  /**
   * [PUBLIC] Lấy tất cả categories đang active
   */
  getAllCategories: async (query = {}) => {
    const { page = 1, limit = 10, search } = query;

    const filter = {
      deletedAt: null,
      isActive: true,
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    };

    return await paginate(BlogCategory, filter, options);
  },

  /**
   * [ADMIN] Lấy tất cả categories (kể cả inactive)
   */
  getAdminCategories: async (query = {}) => {
    const { page = 1, limit = 10, search, isActive } = query;

    const filter = {
      deletedAt: null,
    };

    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === "true";
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
    };

    return await paginate(BlogCategory, filter, options);
  },

  /**
   * Lấy category theo ID
   */
  getCategoryById: async (categoryId) => {
    const category = await BlogCategory.findOne({
      _id: categoryId,
      deletedAt: null,
    });

    if (!category) {
      throw new ApiError(404, "Không tìm thấy danh mục blog");
    }

    return category;
  },

  /**
   * [ADMIN] Tạo category mới
   */
  createCategory: async (categoryData) => {
    const { name, description } = categoryData;

    // Kiểm tra tên đã tồn tại
    const existingCategory = await BlogCategory.findOne({
      name,
      deletedAt: null,
    });

    if (existingCategory) {
      throw new ApiError(400, "Tên danh mục đã tồn tại");
    }

    const slug = createSlug(name);

    const category = new BlogCategory({
      name,
      slug,
      description,
    });

    await category.save();
    return category;
  },

  /**
   * [ADMIN] Cập nhật category
   */
  updateCategory: async (categoryId, updateData) => {
    const category = await blogCategoryService.getCategoryById(categoryId);

    const { name, description, isActive } = updateData;

    if (name && name !== category.name) {
      // Kiểm tra tên mới đã tồn tại chưa
      const existingCategory = await BlogCategory.findOne({
        name,
        deletedAt: null,
        _id: { $ne: categoryId },
      });

      if (existingCategory) {
        throw new ApiError(400, "Tên danh mục đã tồn tại");
      }

      category.name = name;
      category.slug = createSlug(name);
    }

    if (description !== undefined) {
      category.description = description;
    }

    if (isActive !== undefined) {
      category.isActive = isActive;
    }

    await category.save();
    return category;
  },

  /**
   * [ADMIN] Xóa category (soft delete)
   */
  deleteCategory: async (categoryId) => {
    const category = await blogCategoryService.getCategoryById(categoryId);

    // Kiểm tra xem có blog post nào đang dùng category này không
    const BlogPost = require("../models/blogPost");
    const postsCount = await BlogPost.countDocuments({
      category: categoryId,
      deletedAt: null,
    });

    if (postsCount > 0) {
      throw new ApiError(
        400,
        `Không thể xóa danh mục vì có ${postsCount} bài viết đang sử dụng`
      );
    }

    category.deletedAt = new Date();
    await category.save();

    return { message: "Xóa danh mục thành công" };
  },
};

module.exports = blogCategoryService;
