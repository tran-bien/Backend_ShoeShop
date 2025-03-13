const asyncHandler = require("express-async-handler");
const categoryService = require("../services/category.service");

// Lấy tất cả danh mục
exports.getCategories = asyncHandler(async (req, res) => {
  try {
    const categories = await categoryService.getCategories();

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách danh mục",
    });
  }
});

// Lấy chi tiết danh mục theo ID
exports.getCategoryById = asyncHandler(async (req, res) => {
  try {
    const category = await categoryService.getCategoryById(req.params.id);

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy danh mục" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thông tin danh mục",
    });
  }
});

// Tạo danh mục mới
exports.createCategory = asyncHandler(async (req, res) => {
  try {
    const { name, description } = req.body;

    const category = await categoryService.createCategory({
      name,
      description,
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo danh mục",
    });
  }
});

// Cập nhật danh mục
exports.updateCategory = asyncHandler(async (req, res) => {
  try {
    const { name, description, isActive } = req.body;

    const category = await categoryService.updateCategory(req.params.id, {
      name,
      description,
      isActive,
    });

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy danh mục" ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật danh mục",
    });
  }
});

// Xóa danh mục
exports.deleteCategory = asyncHandler(async (req, res) => {
  try {
    await categoryService.deleteCategory(req.params.id);

    res.status(200).json({
      success: true,
      message: "Đã xóa danh mục thành công",
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy danh mục" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi xóa danh mục",
    });
  }
});
