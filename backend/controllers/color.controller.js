const asyncHandler = require("express-async-handler");
const colorService = require("../services/color.service");

// Lấy danh sách màu sắc
exports.getColors = asyncHandler(async (req, res) => {
  try {
    const colors = await colorService.getColors();

    if (colors.length === 0) {
      return res.json({
        success: true,
        count: 0,
        message: "Không có màu sắc nào được tìm thấy.",
        colors: [],
      });
    }

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

    // Kiểm tra đầu vào
    if (!name || !hexCode) {
      return res.status(400).json({
        success: false,
        message: "Tên và mã màu không được để trống",
      });
    }

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

    // Kiểm tra đầu vào
    if (name === undefined || hexCode === undefined) {
      return res.status(400).json({
        success: false,
        message: "Tên và mã màu không được để trống",
      });
    }

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

// Xóa màu sắc (Admin)
exports.deleteColor = asyncHandler(async (req, res) => {
  try {
    const { colorId } = req.params;
    await colorService.deleteColorWithCheck(colorId);

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
