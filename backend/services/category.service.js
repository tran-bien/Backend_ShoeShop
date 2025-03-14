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
    const { canDelete, message } = await this.checkDeletableCategory(
      categoryId
    );

    if (canDelete) {
      // Xóa cứng
      await Category.deleteOne({ _id: categoryId });
      return { success: true, message: "Đã xóa danh mục" };
    } else {
      // Xóa mềm
      const category = await Category.findById(categoryId);
      category.isActive = false; // Đánh dấu không còn hoạt động
      await category.save();
      return { success: true, message: "Danh mục đã được ẩn đi" };
    }
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
