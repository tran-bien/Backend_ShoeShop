const asyncHandler = require("express-async-handler");
const Category = require("@models/category/index");
const Product = require("@models/product/index");
const { createError } = require("@utils/error");
const paginate = require("@utils/paginate");

/**
 * @desc    Lấy danh sách tất cả danh mục
 * @route   GET /api/categories
 * @access  Public
 */
exports.getAllCategories = asyncHandler(async (req, res) => {
  const query = {
    deletedAt: null,
    isActive: true,
  };

  const options = {
    page: req.query.page,
    limit: req.query.limit,
    select: "name slug description",
    sort: { name: 1 },
  };

  const result = await paginate(Category, query, options);

  res.status(200).json(result);
});

/**
 * @desc    Lấy chi tiết danh mục theo ID
 * @route   GET /api/categories/:id
 * @access  Public
 */
exports.getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    _id: req.params.id,
    deletedAt: null,
  });

  if (!category) {
    throw createError(404, "Không tìm thấy danh mục");
  }

  res.status(200).json({
    success: true,
    data: category,
  });
});

/**
 * @desc    Lấy danh mục theo slug
 * @route   GET /api/categories/slug/:slug
 * @access  Public
 */
exports.getCategoryBySlug = asyncHandler(async (req, res) => {
  const category = await Category.findOne({
    slug: req.params.slug,
    deletedAt: null,
  });

  if (!category) {
    throw createError(404, "Không tìm thấy danh mục");
  }

  res.status(200).json({
    success: true,
    data: category,
  });
});

/**
 * @desc    Lấy sản phẩm theo danh mục
 * @route   GET /api/categories/:id/products
 * @access  Public
 */
exports.getProductsByCategory = asyncHandler(async (req, res) => {
  // Kiểm tra danh mục tồn tại
  const category = await Category.findOne({
    _id: req.params.id,
    deletedAt: null,
  });

  if (!category) {
    throw createError(404, "Không tìm thấy danh mục");
  }

  const query = {
    category: req.params.id,
    deletedAt: null,
    isActive: true,
  };

  const options = {
    page: req.query.page,
    limit: req.query.limit,
    select: "name slug description images rating numReviews",
    sort: { createdAt: -1 },
  };

  const result = await paginate(Product, query, options);

  res.status(200).json(result);
});
