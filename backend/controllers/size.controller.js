const asyncHandler = require("express-async-handler");
const sizeService = require("../services/size.service");
const mongoose = require("mongoose");

// Lấy danh sách kích thước
exports.getSizes = asyncHandler(async (req, res) => {
  try {
    const sizes = await sizeService.getSizes();
    res.json({
      success: true,
      count: sizes.length,
      sizes,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách kích thước",
    });
  }
});

// Tạo kích thước mới (Admin)
exports.createSize = asyncHandler(async (req, res) => {
  try {
    const { value, description } = req.body;

    // Kiểm tra đầu vào
    if (!value || isNaN(value)) {
      return res.status(400).json({
        success: false,
        message:
          "Giá trị kích thước không hợp lệ. Vui lòng nhập một số hợp lệ.",
      });
    }

    const size = await sizeService.createSize({
      value: parseFloat(value),
      description,
    });
    res.status(201).json({
      success: true,
      message: "Đã thêm kích thước mới",
      size,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo kích thước",
    });
  }
});

// Cập nhật kích thước (Admin)
exports.updateSize = asyncHandler(async (req, res) => {
  try {
    const { sizeId } = req.params;
    const { value, description, status } = req.body;

    // Kiểm tra đầu vào
    if (value !== undefined && isNaN(value)) {
      return res.status(400).json({
        success: false,
        message:
          "Giá trị kích thước không hợp lệ. Vui lòng nhập một số hợp lệ.",
      });
    }

    const size = await sizeService.updateSize(sizeId, {
      value: value !== undefined ? parseFloat(value) : undefined,
      description,
      status,
    });

    res.json({
      success: true,
      message: "Đã cập nhật kích thước",
      size,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy kích thước" ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật kích thước",
    });
  }
});

// Xóa kích thước (Admin)
exports.deleteSize = asyncHandler(async (req, res) => {
  try {
    const { sizeId } = req.params;
    await sizeService.deleteSizeWithCheck(sizeId);
    res.json({
      success: true,
      message: "Đã xóa kích thước",
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy kích thước" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi xóa kích thước",
    });
  }
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
