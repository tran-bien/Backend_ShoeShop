const Category = require("../models/category.model");
const slugify = require("slugify");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

const categoryService = {
  getCategoriesForUser: async () => {
    return await Category.find({ isActive: true }); // Chỉ lấy danh mục đang hoạt động
  },

  getCategoriesForAdmin: async () => {
    return await Category.find({}); // Lấy tất cả danh mục
  },

  /**
   * Lấy chi tiết danh mục theo ID
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Object>} Thông tin danh mục
   */
  getCategoryByIdForUser: async (categoryId) => {
    //kiểm tra id có hợp lệ không
    validateCategoryId(categoryId);

    const category = await Category.findOne({
      _id: categoryId,
      isActive: true,
    });
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return category;
  },

  /**
   * Lấy chi tiết danh mục theo ID cho admin
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Object>} Thông tin danh mục
   */
  getCategoryByIdForAdmin: async (categoryId) => {
    //kiểm tra id có hợp lệ không
    validateCategoryId(categoryId);

    const category = await Category.findOne({ _id: categoryId });
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

    // Kiểm tra điều kiện đầu vào
    validateCategoryData(categoryData);

    // Kiểm tra trùng lặp
    const existingCategory = await Category.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingCategory) {
      throw new Error("Danh mục này đã tồn tại");
    }

    const category = await Category.create(categoryData);
    return category;
  },

  /**
   * Cập nhật danh mục
   * @param {String} categoryId - ID danh mục
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Danh mục đã cập nhật
   */
  updateCategory: async (id, updateData) => {
    //kiểm tra id có hợp lệ không
    validateCategoryId(id);

    const { name, description } = updateData;

    // Kiểm tra điều kiện đầu vào
    validateCategoryData(updateData);

    // Kiểm tra trùng lặp nếu thay đổi tên
    if (name) {
      const existingCategory = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: id },
      });
      if (existingCategory) {
        throw new Error("Danh mục này đã tồn tại");
      }
    }

    const category = await Category.findById(id);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    Object.assign(category, updateData);
    await category.save();

    return category;
  },

  /**
   * Xóa danh mục (xóa mềm)
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Boolean>} Kết quả xóa
   */
  deleteCategory: async (id) => {
    //kiểm tra id có hợp lệ không
    validateCategoryId(id);

    const category = await Category.findById(id);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    await category.remove();
    return { message: "Danh mục đã được xóa thành công" };
  },

  /**
   * Kiểm tra xem danh mục có thể xóa được không
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Object>} Kết quả kiểm tra
   */
  checkDeletableCategory: async (categoryId) => {
    const category = await Category.findById(categoryId);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    // Kiểm tra xem danh mục có đang được sử dụng không
    const productsUsingCategory = await Product.find({ category: categoryId })
      .select("name _id")
      .limit(10);

    const hasDependencies = productsUsingCategory.length > 0;

    return {
      canDelete: !hasDependencies,
      message: hasDependencies
        ? "Danh mục đang được sử dụng bởi các sản phẩm"
        : "Có thể xóa danh mục này",
    };
  },

  /**
   * Toggle trạng thái hoạt động của danh mục
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Object>} Danh mục đã được toggle
   */
  toggleActive: async (categoryId) => {
    console.log("Attempting to toggle category with ID:", categoryId); // Log ID

    // Kiểm tra ID có hợp lệ không
    validateCategoryId(categoryId);

    const category = await Category.findById(categoryId);
    if (!category) {
      console.log("Category not found for ID:", categoryId); // Log nếu không tìm thấy
      throw new Error("Không tìm thấy danh mục");
    }

    // Toggle trạng thái hoạt động của danh mục
    category.isActive = !category.isActive;
    await category.save();

    console.log("Category toggled successfully:", category); // Log thông tin danh mục đã toggle
    return category;
  },

  /**
   * Lấy danh mục theo slug
   * @param {String} slug - slug danh mục
   * @returns {Promise<Object>} Danh mục tìm thấy
   */
  getCategoryBySlugForUser: async (slug) => {
    const category = await Category.findOne({ slug, isActive: true });
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return category;
  },

  /**
   * Lấy danh mục theo slug cho admin
   * @param {String} slug - slug danh mục
   * @returns {Promise<Object>} Danh mục tìm thấy
   */
  getCategoryBySlugForAdmin: async (slug) => {
    const category = await Category.findOne({ slug });
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }
    return category;
  },
};

module.exports = categoryService;
