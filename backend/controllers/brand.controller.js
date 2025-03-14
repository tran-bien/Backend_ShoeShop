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
  try {
    const { name, description, logo } = req.body;

    // Kiểm tra đầu vào
    if (!name || !logo) {
      return res.status(400).json({
        success: false,
        message: "Tên và logo không được để trống",
      });
    }

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

    // Kiểm tra đầu vào
    if (!name || !logo) {
      return res.status(400).json({
        success: false,
        message: "Tên và logo không được để trống",
      });
    }

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
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "ID không hợp lệ",
      });
    }
    const result = await brandService.deleteBrand(id);
    res.json(result);
  } catch (error) {
    res
      .status(error.message === "Không tìm thấy thương hiệu" ? 404 : 500)
      .json({
        success: false,
        message: error.message || "Lỗi khi xóa thương hiệu",
      });
  }
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
