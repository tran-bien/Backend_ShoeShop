const Category = require("../models/category.model");
const slugify = require("slugify");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

const categoryService = {
  /**
   * Lấy tất cả danh mục cho người dùng
   * @returns {Promise<Array>} Danh sách danh mục
   */
  getCategoriesForUser: async () => {
    return await Category.find({ isActive: true }); // Chỉ lấy danh mục đang hoạt động
  },

  /**
   * Lấy tất cả danh mục cho admin
   * @returns {Promise<Array>} Danh sách danh mục
   */
  getCategoriesForAdmin: async () => {
    return await Category.find({}); // Lấy tất cả danh mục
  },

  /**
   * Lấy chi tiết danh mục theo ID
   * @param {String} categoryId - ID danh mục
   * @param {Boolean} isAdmin - Kiểm tra xem người dùng có phải là admin không
   * @returns {Promise<Object>} Thông tin danh mục
   */
  getCategoryById: async (categoryId, isAdmin = false) => {
    const query = isAdmin
      ? { _id: categoryId }
      : { _id: categoryId, isActive: true }; // Nếu là admin, lấy tất cả
    const category = await Category.findOne(query);
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
    const { name, description, parentId } = categoryData;

    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error("Tên danh mục không được để trống");
    }

    if (description && description.trim().length === 0) {
      throw new Error("Mô tả danh mục không được để trống");
    }

    // Kiểm tra parentId nếu có
    if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        throw new Error("ID danh mục cha không hợp lệ");
      }

      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        throw new Error("Không tìm thấy danh mục cha");
      }
    }

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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID danh mục không hợp lệ");
    }

    const { name, description, parentId } = updateData;

    // Validation
    if (name && name.trim().length === 0) {
      throw new Error("Tên danh mục không được để trống");
    }

    if (description && description.trim().length === 0) {
      throw new Error("Mô tả danh mục không được để trống");
    }

    // Kiểm tra parentId nếu có
    if (parentId) {
      if (!mongoose.Types.ObjectId.isValid(parentId)) {
        throw new Error("ID danh mục cha không hợp lệ");
      }

      const parentCategory = await Category.findById(parentId);
      if (!parentCategory) {
        throw new Error("Không tìm thấy danh mục cha");
      }

      // Kiểm tra vòng lặp (không cho phép danh mục là cha của chính nó)
      if (parentId === id) {
        throw new Error("Không thể chọn chính danh mục này làm danh mục cha");
      }
    }

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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID danh mục không hợp lệ");
    }

    const category = await Category.findById(id);
    if (!category) {
      throw new Error("Không tìm thấy danh mục");
    }

    // Kiểm tra xem danh mục có con không
    const hasChildren = await Category.exists({ parentId: id });
    if (hasChildren) {
      throw new Error("Không thể xóa danh mục có danh mục con");
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
   * Ẩn danh mục (đánh dấu không hoạt động)
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Object>} Danh mục đã được ẩn
   */
  hideCategory: async (categoryId) => {
    console.log("Attempting to hide category with ID:", categoryId); // Log ID

    // Kiểm tra ID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error("ID không hợp lệ");
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      console.log("Category not found for ID:", categoryId); // Log nếu không tìm thấy
      throw new Error("Không tìm thấy danh mục");
    }

    // Đánh dấu danh mục là không hoạt động
    category.isActive = false;
    await category.save();

    console.log("Category hidden successfully:", category); // Log thông tin danh mục đã ẩn
    return category;
  },

  /**
   * Kích hoạt danh mục (đánh dấu hoạt động)
   * @param {String} categoryId - ID danh mục
   * @returns {Promise<Object>} Danh mục đã được kích hoạt
   */
  activateCategory: async (categoryId) => {
    console.log("Attempting to activate category with ID:", categoryId); // Log ID

    // Kiểm tra ID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new Error("ID không hợp lệ");
    }

    const category = await Category.findById(categoryId);
    if (!category) {
      console.log("Category not found for ID:", categoryId); // Log nếu không tìm thấy
      throw new Error("Không tìm thấy danh mục");
    }

    // Đánh dấu danh mục là hoạt động
    category.isActive = true;
    await category.save();

    console.log("Category activated successfully:", category); // Log thông tin danh mục đã kích hoạt
    return category;
  },
};

module.exports = categoryService;
