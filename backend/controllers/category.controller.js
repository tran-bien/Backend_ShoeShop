const asyncHandler = require("express-async-handler");
const categoryService = require("../services/category.service");
const mongoose = require("mongoose");
const { isAdmin } = require("../services/auth.service"); // Import service

// Lấy tất cả danh mục cho người dùng
exports.getCategoriesForUser = asyncHandler(async (req, res) => {
  try {
    const categories = await categoryService.getCategoriesForUser();

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

// Lấy tất cả danh mục cho admin
exports.getCategoriesForAdmin = asyncHandler(async (req, res) => {
  try {
    const categories = await categoryService.getCategoriesForAdmin();

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
    const categoryId = req.params.id;

    // Kiểm tra ID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    // Kiểm tra admin thông qua token
    const token = req.headers.authorization;
    const adminStatus = await isAdmin(token); // Sử dụng service

    // Lấy danh mục theo ID
    const category = await categoryService.getCategoryById(
      categoryId,
      adminStatus
    );

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

// Ẩn danh mục
exports.hideCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID từ tham số

    // Kiểm tra ID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    const category = await categoryService.hideCategory(id); // Gọi service để ẩn danh mục

    res.json({
      success: true,
      message: "Danh mục đã được ẩn",
      data: category,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy danh mục" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi ẩn danh mục",
    });
  }
});

// Kích hoạt danh mục
exports.activateCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params; // Lấy ID từ tham số

    // Kiểm tra ID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    const category = await categoryService.activateCategory(id); // Gọi service để kích hoạt danh mục

    res.json({
      success: true,
      message: "Danh mục đã được kích hoạt",
      data: category,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy danh mục" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi kích hoạt danh mục",
    });
  }
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
