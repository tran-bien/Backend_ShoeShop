const asyncHandler = require("express-async-handler");
const brandService = require("../services/brand.service");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { isAdmin } = require("../services/auth.service");

// Lấy tất cả thương hiệu cho người dùng
exports.getBrandsForUser = asyncHandler(async (req, res) => {
  try {
    const brands = await brandService.getBrandsForUser();
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

// Lấy tất cả thương hiệu cho admin
exports.getBrandsForAdmin = asyncHandler(async (req, res) => {
  try {
    const brands = await brandService.getBrandsForAdmin();
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
    const brandId = req.params.id;

    // Kiểm tra ID có hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }

    // Kiểm tra admin thông qua token
    const token = req.headers.authorization;
    const adminStatus = await isAdmin(token);

    // Lấy thương hiệu theo ID
    const brand = await brandService.getBrandById(brandId, adminStatus);
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
  const brand = await brandService.createBrand(req.body);
  res.status(201).json({
    success: true,
    data: brand,
  });
});

// Cập nhật thương hiệu
exports.updateBrand = asyncHandler(async (req, res) => {
  const brand = await brandService.updateBrand(req.params.id, req.body);
  res.json({
    success: true,
    data: brand,
  });
});

// Xóa thương hiệu
exports.deleteBrand = asyncHandler(async (req, res) => {
  await brandService.deleteBrand(req.params.id);
  res.json({
    success: true,
    message: "Xóa thương hiệu thành công",
  });
});

// Ẩn thương hiệu
exports.hideBrand = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }
    const brand = await brandService.hideBrand(id);
    res.json({
      success: true,
      message: "Thương hiệu đã được ẩn",
      data: brand,
    });
  } catch (error) {
    res
      .status(error.message === "Không tìm thấy thương hiệu" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Lỗi khi ẩn thương hiệu",
      });
  }
});

// Kích hoạt thương hiệu
exports.activateBrand = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }
    const brand = await brandService.activateBrand(id);
    res.json({
      success: true,
      message: "Thương hiệu đã được kích hoạt",
      data: brand,
    });
  } catch (error) {
    res
      .status(error.message === "Không tìm thấy thương hiệu" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Lỗi khi kích hoạt thương hiệu",
      });
  }
});

// Kiểm tra xem thương hiệu có thể xóa được không
exports.checkDeletableBrand = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const result = await brandService.checkDeletableBrand(id);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res
      .status(error.message === "Không tìm thấy thương hiệu" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Lỗi khi kiểm tra thương hiệu trước khi xóa",
      });
  }
});

exports.getAllBrands = asyncHandler(async (req, res) => {
  const brands = await brandService.getAllBrands();
  res.json({
    success: true,
    data: brands,
  });
});

exports.getBrandDetails = asyncHandler(async (req, res) => {
  const brand = await brandService.getBrandDetails(req.params.id);
  res.json({
    success: true,
    data: brand,
  });
});
