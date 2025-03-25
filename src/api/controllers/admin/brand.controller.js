const asyncHandler = require("express-async-handler");
const Brand = require("@models/brand/index");
const Product = require("@models/product/index");
const { createError } = require("@utils/error");
const imageService = require("@services/image.service");
const paginate = require("@utils/paginate");

/**
 * @desc    Lấy tất cả thương hiệu (bao gồm cả đã xóa mềm nếu có query)
 * @route   GET /api/admin/brands
 * @access  Admin
 */
exports.getAllBrands = asyncHandler(async (req, res) => {
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

  const result = await paginate(Brand, query, options);

  res.status(200).json(result);
});

/**
 * @desc    Tạo thương hiệu mới
 * @route   POST /api/admin/brands
 * @access  Admin
 */
exports.createBrand = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;

  const brand = await Brand.create({
    name,
    description,
    isActive: isActive !== undefined ? isActive : true,
    logo: { url: "", public_id: "" }, // Khởi tạo logo trống
  });

  res.status(201).json({
    success: true,
    data: brand,
  });
});

/**
 * @desc    Cập nhật thông tin thương hiệu
 * @route   PUT /api/admin/brands/:id
 * @access  Admin
 */
exports.updateBrand = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  const brandId = req.params.id;

  // Kiểm tra thương hiệu tồn tại
  const brand = await Brand.findOne({ _id: brandId, deletedAt: null });
  if (!brand) {
    throw createError(404, "Không tìm thấy thương hiệu");
  }

  // Cập nhật thông tin
  const updatedBrand = await Brand.findByIdAndUpdate(
    brandId,
    {
      name: name || brand.name,
      description: description !== undefined ? description : brand.description,
      isActive: isActive !== undefined ? isActive : brand.isActive,
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    success: true,
    data: updatedBrand,
  });
});

/**
 * @desc    Xóa mềm thương hiệu
 * @route   DELETE /api/admin/brands/:id
 * @access  Admin
 */
exports.softDeleteBrand = asyncHandler(async (req, res) => {
  const brandId = req.params.id;

  // Kiểm tra thương hiệu tồn tại
  const brand = await Brand.findOne({ _id: brandId, deletedAt: null });
  if (!brand) {
    throw createError(404, "Không tìm thấy thương hiệu");
  }

  // Kiểm tra xem có sản phẩm nào đang sử dụng thương hiệu này không
  const productsCount = await Product.countDocuments({
    brand: brandId,
    deletedAt: null,
  });
  if (productsCount > 0) {
    throw createError(
      400,
      "Không thể xóa thương hiệu đang được sử dụng bởi sản phẩm"
    );
  }

  // Xóa mềm thương hiệu
  await brand.softDelete(req.user._id);

  res.status(200).json({
    success: true,
    message: "Đã xóa thương hiệu thành công",
  });
});

/**
 * @desc    Khôi phục thương hiệu đã xóa mềm
 * @route   PATCH /api/admin/brands/:id/restore
 * @access  Admin
 */
exports.restoreBrand = asyncHandler(async (req, res) => {
  const brandId = req.params.id;

  // Kiểm tra thương hiệu tồn tại và đã bị xóa mềm
  const brand = await Brand.findOne(
    { _id: brandId, deletedAt: { $ne: null } },
    { includeDeleted: true }
  );

  if (!brand) {
    throw createError(404, "Không tìm thấy thương hiệu đã xóa");
  }

  // Khôi phục thương hiệu
  await brand.restore();

  res.status(200).json({
    success: true,
    message: "Đã khôi phục thương hiệu thành công",
    data: brand,
  });
});
