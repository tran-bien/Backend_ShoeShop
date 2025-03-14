const asyncHandler = require("express-async-handler");
const sizeService = require("../services/size.service");
const mongoose = require("mongoose");

// Lấy danh sách kích thước
exports.getAllSizes = asyncHandler(async (req, res) => {
  const sizes = await sizeService.getAllSizes();
  res.json({
    success: true,
    data: sizes,
  });
});

// Tạo kích thước mới (Admin)
exports.createSize = asyncHandler(async (req, res) => {
  const size = await sizeService.createSize(req.body);
  res.status(201).json({
    success: true,
    data: size,
  });
});

// Cập nhật kích thước (Admin)
exports.updateSize = asyncHandler(async (req, res) => {
  const size = await sizeService.updateSize(req.params.id, req.body);
  res.json({
    success: true,
    data: size,
  });
});

// Xóa kích thước (Admin)
exports.deleteSize = asyncHandler(async (req, res) => {
  await sizeService.deleteSize(req.params.id);
  res.json({
    success: true,
    message: "Xóa kích thước thành công",
  });
});

// Kiểm tra xem kích thước có thể xóa được không
exports.checkDeletableSize = asyncHandler(async (req, res) => {
  try {
    const { sizeId } = req.params;
    const result = await sizeService.checkDeletableSize(sizeId);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy kích thước" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi kiểm tra kích thước trước khi xóa",
    });
  }
});

exports.getSizeDetails = asyncHandler(async (req, res) => {
  const size = await sizeService.getSizeDetails(req.params.id);
  res.json({
    success: true,
    data: size,
  });
});
