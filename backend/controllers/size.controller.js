const asyncHandler = require("express-async-handler");
const sizeService = require("../services/size.service");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

// Lấy danh sách kích thước
exports.getSizes = asyncHandler(async (req, res) => {
  try {
    const { showAll } = req.query;
    const sizes = await sizeService.getSizes(showAll === "true");

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

    const size = await sizeService.createSize({ value, description });

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

    const size = await sizeService.updateSize(sizeId, {
      value,
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

// Kiểm tra trước khi xóa (Admin)
exports.checkBeforeDelete = asyncHandler(async (req, res) => {
  try {
    const { sizeId } = req.params;
    const result = await sizeService.checkBeforeDelete(sizeId);

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

// Vô hiệu hóa kích thước (Admin)
exports.deactivateSize = asyncHandler(async (req, res) => {
  try {
    const { sizeId } = req.params;
    const size = await sizeService.deactivateSize(sizeId);

    res.json({
      success: true,
      message: "Đã vô hiệu hóa kích thước",
      size,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy kích thước" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi vô hiệu hóa kích thước",
    });
  }
});

// Kích hoạt lại kích thước (Admin)
exports.activateSize = asyncHandler(async (req, res) => {
  try {
    const { sizeId } = req.params;
    const size = await sizeService.activateSize(sizeId);

    res.json({
      success: true,
      message: "Đã kích hoạt lại kích thước",
      size,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy kích thước" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi kích hoạt lại kích thước",
    });
  }
});

// Xóa kích thước (Admin)
exports.deleteSize = asyncHandler(async (req, res) => {
  try {
    const { sizeId } = req.params;
    await sizeService.deleteSize(sizeId);

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
