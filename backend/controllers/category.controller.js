const asyncHandler = require("express-async-handler");
const categoryService = require("../services/category.service");
const mongoose = require("mongoose");
const { isAdmin } = require("../services/auth.service"); // Import service

// Lấy tất cả danh mục cho người dùng
exports.getCategoriesForUser = asyncHandler(async (req, res) => {
  const categories = await categoryService.getCategoriesForUser();
  res.status(200).json({
    success: true,
    data: categories,
  });
});

// Lấy tất cả danh mục cho admin
exports.getCategoriesForAdmin = asyncHandler(async (req, res) => {
  const categories = await categoryService.getCategoriesForAdmin();
  res.status(200).json({
    success: true,
    data: categories,
  });
});

// Lấy chi tiết danh mục theo ID
exports.getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.id);
  res.status(200).json({
    success: true,
    data: category,
  });
});

// Tạo danh mục mới
exports.createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body);
  res.status(201).json({
    success: true,
    data: category,
  });
});

// Cập nhật danh mục
exports.updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(
    req.params.id,
    req.body
  );
  res.json({
    success: true,
    data: category,
  });
});

// Xóa danh mục
exports.deleteCategory = asyncHandler(async (req, res) => {
  await categoryService.deleteCategory(req.params.id);
  res.json({
    success: true,
    message: "Xóa danh mục thành công",
  });
});

exports.checkDeletableCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const result = await categoryService.checkDeletableCategory(id);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy danh mục" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi kiểm tra danh mục trước khi xóa",
    });
  }
});

// Toggle trạng thái hoạt động của danh mục
exports.toggleActive = asyncHandler(async (req, res) => {
  const category = await categoryService.toggleActive(req.params.id);
  res.status(200).json({
    success: true,
    data: category,
    message: `Đã ${category.isActive ? "kích hoạt" : "vô hiệu hóa"} danh mục`,
  });
});

exports.getAllCategories = asyncHandler(async (req, res) => {
  const categories = await categoryService.getAllCategories();
  res.json({
    success: true,
    data: categories,
  });
});

exports.getCategoryDetails = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryDetails(req.params.id);
  res.json({
    success: true,
    data: category,
  });
});
