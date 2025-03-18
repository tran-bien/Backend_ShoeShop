const asyncHandler = require("express-async-handler");
const categoryService = require("../../services/category.service");

/**
 * @desc    Lấy tất cả danh mục cho người dùng
 * @route   GET /api/categories
 * @access  Public
 */
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
      message: error.message || "Lỗi khi lấy danh mục",
    });
  }
});

/**
 * @desc    Lấy danh mục theo slug cho người dùng
 * @route   GET /api/categories/slug/:slug
 * @access  Public
 */
exports.getCategoryBySlugForUser = asyncHandler(async (req, res) => {
  try {
    const category = await categoryService.getCategoryBySlugForUser(
      req.params.slug
    );
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh mục theo slug",
    });
  }
});

/**
 * @desc    Lấy danh mục theo ID cho người dùng
 * @route   GET /api/categories/:id
 * @access  Public
 */
exports.getCategoryByIdForUser = asyncHandler(async (req, res) => {
  try {
    const category = await categoryService.getCategoryByIdForUser(
      req.params.id
    );
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh mục",
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
      message: error.message || "Lỗi khi lấy danh mục",
    });
  }
});

// Tạo danh mục mới
exports.createCategory = asyncHandler(async (req, res) => {
  try {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi tạo danh mục",
    });
  }
});

// Cập nhật danh mục
exports.updateCategory = asyncHandler(async (req, res) => {
  try {
    const category = await categoryService.updateCategory(
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật danh mục",
    });
  }
});

// Xóa danh mục
exports.deleteCategory = asyncHandler(async (req, res) => {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.json({
      success: true,
      message: "Xóa danh mục thành công",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi xóa danh mục",
    });
  }
});

exports.checkDeletableCategory = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const result = await categoryService.checkDeletableCategory(id);

    res.json({
      success: true,
      message: result,
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

exports.getCategoriesForAdmin = asyncHandler(async (req, res) => {
  try {
    const categories = await categoryService.getCategoriesForAdmin();
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh mục",
    });
  }
});

exports.getCategoryBySlugForAdmin = asyncHandler(async (req, res) => {
  try {
    const category = await categoryService.getCategoryBySlugForAdmin(
      req.params.slug
    );
    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh mục",
    });
  }
});
