const Category = require("../models/category.model");
const slugify = require("slugify");

const categoryService = {
  /**
   * Lấy tất cả danh mục đang hoạt động
   * @returns {Promise<Array>} Danh sách danh mục
   */
  getCategories: async () => {
    const categories = await Category.find({ isActive: true });
    return categories;
  },

  /**
   * Lấy chi tiết danh mục theo ID
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Object>} Thông tin danh mục
   */
  getCategoryById: async (categoryId) => {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return category;
  },

  /**
   * Tạo danh mục mới
   * @param {Object} categoryData - Dữ liệu danh mục
   * @returns {Promise<Object>} Danh mục đã tạo
   */
  createCategory: async (categoryData) => {
    const { name, description } = categoryData;

    // Kiểm tra tên danh mục
    if (!name || name.trim() === "") {
      throw new Error("Tên danh mục không được để trống");
    }

    // Kiểm tra độ dài tên
    if (name.length > 100) {
      throw new Error("Tên danh mục không được vượt quá 100 ký tự");
    }

    // Tạo slug từ tên
    const slug = slugify(name, { lower: true });

    // Kiểm tra danh mục đã tồn tại (theo tên chính xác)
    const existingCategoryByName = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingCategoryByName) {
      throw new Error("Tên danh mục này đã tồn tại");
    }

    // Kiểm tra danh mục đã tồn tại (theo slug)
    const existingCategoryBySlug = await Category.findOne({ slug });
    if (existingCategoryBySlug) {
      throw new Error("Danh mục này đã tồn tại với tên tương tự");
    }

    // Tạo danh mục mới
    const category = await Category.create({
      name,
      description,
      slug,
    });

    return category;
  },

  /**
   * Cập nhật danh mục
   * @param {String} categoryId - ID danh mục
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Danh mục đã cập nhật
   */
  updateCategory: async (categoryId, updateData) => {
    const { name, description, isActive } = updateData;
    let category = await Category.findById(categoryId);

    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    // Kiểm tra nếu tên được cung cấp
    if (name !== undefined) {
      // Kiểm tra tên không được trống
      if (!name || name.trim() === "") {
        throw new Error("Tên danh mục không được để trống");
      }

      // Kiểm tra độ dài tên
      if (name.length > 100) {
        throw new Error("Tên danh mục không được vượt quá 100 ký tự");
      }

      // Cập nhật slug nếu tên thay đổi
      if (name !== category.name) {
        const slug = slugify(name, { lower: true });

        // Kiểm tra tên đã tồn tại (theo tên chính xác)
        const existingCategoryByName = await Category.findOne({
          name: { $regex: new RegExp(`^${name}$`, "i") },
          _id: { $ne: categoryId },
        });

        if (existingCategoryByName) {
          throw new Error("Tên danh mục này đã tồn tại");
        }

        // Kiểm tra slug đã tồn tại
        const existingCategory = await Category.findOne({
          slug,
          _id: { $ne: categoryId },
        });

        if (existingCategory) {
          throw new Error("Danh mục với tên này đã tồn tại");
        }

        category.slug = slug;
      }
    }

    // Cập nhật thông tin
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();
    return category;
  },

  /**
   * Xóa danh mục (xóa mềm)
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Boolean>} Kết quả xóa
   */
  deleteCategory: async (categoryId) => {
    const category = await Category.findById(categoryId);

    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    // Xóa mềm - chỉ đánh dấu không còn hoạt động
    category.isActive = false;
    await category.save();

    return true;
  },
};

module.exports = categoryService;
