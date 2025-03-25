const asyncHandler = require("express-async-handler");
const Brand = require("@models/brand/index");
const Product = require("@models/product/index");
const { createError } = require("@utils/error");
const paginate = require("@utils/paginate");

/**
 * @desc    Lấy danh sách tất cả thương hiệu
 * @route   GET /api/brands
 * @access  Public
 */
exports.getAllBrands = asyncHandler(async (req, res) => {
  const query = {
    deletedAt: null,
    isActive: true,
  };

  const options = {
    page: req.query.page,
    limit: req.query.limit,
    select: "name slug description logo",
    sort: { name: 1 },
  };

  const result = await paginate(Brand, query, options);

  res.status(200).json(result);
});

/**
 * @desc    Lấy chi tiết thương hiệu theo ID
 * @route   GET /api/brands/:id
 * @access  Public
 */
exports.getBrandById = asyncHandler(async (req, res) => {
  const brand = await Brand.findOne({ _id: req.params.id, deletedAt: null });

  if (!brand) {
    throw createError(404, "Không tìm thấy thương hiệu");
  }

  res.status(200).json({
    success: true,
    data: brand,
  });
});

/**
 * @desc    Lấy thương hiệu theo slug
 * @route   GET /api/brands/slug/:slug
 * @access  Public
 */
exports.getBrandBySlug = asyncHandler(async (req, res) => {
  const brand = await Brand.findOne({ slug: req.params.slug, deletedAt: null });

  if (!brand) {
    throw createError(404, "Không tìm thấy thương hiệu");
  }

  res.status(200).json({
    success: true,
    data: brand,
  });
});

/**
 * @desc    Lấy sản phẩm theo thương hiệu
 * @route   GET /api/brands/:id/products
 * @access  Public
 */
exports.getProductsByBrand = asyncHandler(async (req, res) => {
  // Kiểm tra thương hiệu tồn tại
  const brand = await Brand.findOne({ _id: req.params.id, deletedAt: null });

  if (!brand) {
    throw createError(404, "Không tìm thấy thương hiệu");
  }

  const query = {
    brand: req.params.id,
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
