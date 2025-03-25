const { Category } = require("@models");
const paginate = require("@utils/pagination");

const categoryService = {
  /**
   * Lấy danh sách danh mục với phân trang (chỉ lấy các danh mục active và chưa xóa)
   */
  getAllCategories: async (query) => {
    const { page = 1, limit = 10, name, isActive, sort } = query;

    // Xây dựng query filter
    const filter = {};

    // Filter theo tên (tìm kiếm không phân biệt hoa thường)
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Filter theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    // Tạo options cho paginate
    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
    };

    return await paginate(Category, filter, options);
  },

  /**
   * Lấy thông tin một danh mục theo ID (bao gồm cả đã xóa nếu là admin)
   */
  getCategoryById: async (categoryId, includeDeleted = false) => {
    const query = { _id: categoryId };
    if (includeDeleted) {
      query.includeDeleted = true;
    }
    const category = await Category.findOne(query);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return category;
  },

  /**
   * Lấy danh mục theo slug
   */
  getCategoryBySlug: async (slug) => {
    const category = await Category.findOne({ slug, isActive: true });
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return category;
  },

  /**
   * Tạo danh mục mới
   */
  createCategory: async (categoryData) => {
    try {
      const category = new Category(categoryData);
      await category.save();
      return category;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error("Tên danh mục đã tồn tại");
      }
      throw error;
    }
  },

  /**
   * Cập nhật danh mục
   */
  updateCategory: async (categoryId, categoryData) => {
    try {
      const category = await Category.findById(categoryId);
      if (!category) {
        throw new Error("Không tìm thấy danh mục");
      }

      Object.assign(category, categoryData);
      await category.save();
      return category;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error("Tên danh mục đã tồn tại");
      }
      throw error;
    }
  },

  /**
   * Xóa mềm danh mục
   */
  deleteCategory: async (categoryId, userId) => {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    await category.softDelete(userId);
    return { message: "Xóa danh mục thành công" };
  },

  /**
   * Khôi phục danh mục đã xóa mềm
   */
  restoreCategory: async (categoryId) => {
    const category = await Category.findOne({
      _id: categoryId,
      includeDeleted: true,
    });
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    if (!category.deletedAt) {
      throw new Error("Danh mục chưa bị xóa");
    }

    await category.restore();
    return { message: "Khôi phục danh mục thành công", category };
  },

  /**
   * Danh sách danh mục đã xóa (chỉ dành cho admin)
   */
  getDeletedCategories: async (query) => {
    const { page = 1, limit = 10, name, sort } = query;

    // Xây dựng query filter để lấy chỉ các danh mục đã xóa
    const filter = { deletedAt: { $ne: null }, includeDeleted: true };

    // Filter theo tên (tìm kiếm không phân biệt hoa thường)
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Tạo options cho paginate
    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { deletedAt: -1 },
    };

    return await paginate(Category, filter, options);
  },

  /**
   * Cập nhật trạng thái active
   */
  updateCategoryStatus: async (categoryId, isActive) => {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    category.isActive = isActive;
    await category.save();
    return {
      message: `Danh mục đã được ${isActive ? "kích hoạt" : "vô hiệu hóa"}`,
      category,
    };
  },
};

module.exports = categoryService;
