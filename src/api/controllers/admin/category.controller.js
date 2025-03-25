const asyncHandler = require("express-async-handler");
const Category = require("@models/category/index");
const Product = require("@models/product/index");
const { createError } = require("@utils/error");
const paginate = require("@utils/paginate");

/**
 * @desc    Lấy tất cả danh mục (bao gồm cả đã xóa mềm nếu có query)
 * @route   GET /api/admin/categories
 * @access  Admin
 */
exports.getAllCategories = asyncHandler(async (req, res) => {
  const { includeDeleted } = req.query;

  let query = {};
  if (includeDeleted !== "true") {
    query.deletedAt = null;
  }

  const options = {
    page: req.query.page,
    limit: req.query.limit,
    sort: { createdAt: -1 },
  };

  const result = await paginate(Category, query, options);

  res.status(200).json(result);
});

/**
 * @desc    Tạo danh mục mới
 * @route   POST /api/admin/categories
 * @access  Admin
 */
exports.createCategory = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;

  const category = await Category.create({
    name,
    description,
    isActive: isActive !== undefined ? isActive : true,
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

/**
 * @desc    Cập nhật thông tin danh mục
 * @route   PUT /api/admin/categories/:id
 * @access  Admin
 */
exports.updateCategory = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  const categoryId = req.params.id;

  // Kiểm tra danh mục tồn tại
  const category = await Category.findOne({ _id: categoryId, deletedAt: null });
  if (!category) {
    throw createError(404, "Không tìm thấy danh mục");
  }

  // Cập nhật thông tin
  const updatedCategory = await Category.findByIdAndUpdate(
    categoryId,
    {
      name: name || category.name,
      description:
        description !== undefined ? description : category.description,
      isActive: isActive !== undefined ? isActive : category.isActive,
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: updatedCategory,
  });
});

/**
 * @desc    Xóa mềm danh mục
 * @route   DELETE /api/admin/categories/:id
 * @access  Admin
 */
exports.softDeleteCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;

  // Kiểm tra danh mục tồn tại
  const category = await Category.findOne({ _id: categoryId, deletedAt: null });
  if (!category) {
    throw createError(404, "Không tìm thấy danh mục");
  }

  // Kiểm tra xem có sản phẩm nào đang sử dụng danh mục này không
  const productsCount = await Product.countDocuments({
    category: categoryId,
    deletedAt: null,
  });
  if (productsCount > 0) {
    throw createError(
      400,
      "Không thể xóa danh mục đang được sử dụng bởi sản phẩm"
    );
  }

  // Xóa mềm danh mục
  await category.softDelete(req.user._id);

  res.status(200).json({
    success: true,
    message: "Đã xóa danh mục thành công",
  });
});

/**
 * @desc    Khôi phục danh mục đã xóa mềm
 * @route   PATCH /api/admin/categories/:id/restore
 * @access  Admin
 */
exports.restoreCategory = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;

  // Kiểm tra danh mục tồn tại và đã bị xóa mềm
  const category = await Category.findOne(
    { _id: categoryId, deletedAt: { $ne: null } },
    { includeDeleted: true }
  );

  if (!category) {
    throw createError(404, "Không tìm thấy danh mục đã xóa");
  }

  // Khôi phục danh mục
  await category.restore();

  res.status(200).json({
    success: true,
    message: "Đã khôi phục danh mục thành công",
    data: category,
  });
});
