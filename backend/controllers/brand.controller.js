const asyncHandler = require("express-async-handler");
const brandService = require("../services/brand.service");
const slugify = require("slugify");

// Lấy tất cả thương hiệu
exports.getBrands = asyncHandler(async (req, res) => {
  try {
    const brands = await brandService.getBrands();

    res.status(200).json({
      success: true,
      data: brands,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách thương hiệu",
    });
  }
});

// Lấy chi tiết thương hiệu theo ID
exports.getBrandById = asyncHandler(async (req, res) => {
  try {
    const brand = await brandService.getBrandById(req.params.id);

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    res
      .status(error.message === "Không tìm thấy thương hiệu" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Lỗi khi lấy thông tin thương hiệu",
      });
  }
});

// Tạo thương hiệu mới
exports.createBrand = asyncHandler(async (req, res) => {
  try {
    const { name, description, logo } = req.body;

    const brand = await brandService.createBrand({
      name,
      description,
      logo,
    });

    res.status(201).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo thương hiệu",
    });
  }
});

// Cập nhật thương hiệu
exports.updateBrand = asyncHandler(async (req, res) => {
  try {
    const { name, description, logo, isActive } = req.body;

    const brand = await brandService.updateBrand(req.params.id, {
      name,
      description,
      logo,
      isActive,
    });

    res.status(200).json({
      success: true,
      data: brand,
    });
  } catch (error) {
    res
      .status(error.message === "Không tìm thấy thương hiệu" ? 404 : 400)
      .json({
        success: false,
        message: error.message || "Lỗi khi cập nhật thương hiệu",
      });
  }
});

// Xóa thương hiệu
exports.deleteBrand = asyncHandler(async (req, res) => {
  try {
    await brandService.deleteBrand(req.params.id);

    res.status(200).json({
      success: true,
      message: "Đã xóa thương hiệu thành công",
    });
  } catch (error) {
    res
      .status(error.message === "Không tìm thấy thương hiệu" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Lỗi khi xóa thương hiệu",
      });
  }
});
