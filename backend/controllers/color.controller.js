const asyncHandler = require("express-async-handler");
const colorService = require("../services/color.service");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;

// Lấy danh sách màu sắc
exports.getColors = asyncHandler(async (req, res) => {
  try {
    const { showAll } = req.query;
    const colors = await colorService.getColors(showAll === "true");

    res.json({
      success: true,
      count: colors.length,
      colors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách màu sắc",
    });
  }
});

// Tạo màu sắc mới (Admin)
exports.createColor = asyncHandler(async (req, res) => {
  try {
    const { name, hexCode } = req.body;

    const color = await colorService.createColor({ name, hexCode });

    res.status(201).json({
      success: true,
      message: "Đã thêm màu sắc mới",
      color,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo màu sắc",
    });
  }
});

// Cập nhật màu sắc (Admin)
exports.updateColor = asyncHandler(async (req, res) => {
  try {
    const { colorId } = req.params;
    const { name, hexCode, status } = req.body;

    const color = await colorService.updateColor(colorId, {
      name,
      hexCode,
      status,
    });

    res.json({
      success: true,
      message: "Đã cập nhật màu sắc",
      color,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy màu sắc" ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật màu sắc",
    });
  }
});

// Kiểm tra trước khi xóa (Admin)
exports.checkBeforeDelete = asyncHandler(async (req, res) => {
  try {
    const { colorId } = req.params;
    const result = await colorService.checkBeforeDelete(colorId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy màu sắc" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi kiểm tra màu sắc trước khi xóa",
    });
  }
});

// Vô hiệu hóa màu sắc (Admin)
exports.deactivateColor = asyncHandler(async (req, res) => {
  try {
    const { colorId } = req.params;
    const color = await colorService.deactivateColor(colorId);

    res.json({
      success: true,
      message: "Đã vô hiệu hóa màu sắc",
      color,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy màu sắc" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi vô hiệu hóa màu sắc",
    });
  }
});

// Kích hoạt lại màu sắc (Admin)
exports.activateColor = asyncHandler(async (req, res) => {
  try {
    const { colorId } = req.params;
    const color = await colorService.activateColor(colorId);

    res.json({
      success: true,
      message: "Đã kích hoạt lại màu sắc",
      color,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy màu sắc" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi kích hoạt lại màu sắc",
    });
  }
});

// Xóa màu sắc (Admin)
exports.deleteColor = asyncHandler(async (req, res) => {
  try {
    const { colorId } = req.params;
    await colorService.deleteColor(colorId);

    res.json({
      success: true,
      message: "Đã xóa màu sắc",
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy màu sắc" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi xóa màu sắc",
    });
  }
});
