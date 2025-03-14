const asyncHandler = require("express-async-handler");
const colorService = require("../services/color.service");

// Lấy danh sách màu sắc
exports.getAllColors = asyncHandler(async (req, res) => {
  const colors = await colorService.getAllColors();
  res.json({
    success: true,
    data: colors,
  });
});

// Tạo màu sắc mới (Admin)
exports.createColor = asyncHandler(async (req, res) => {
  const color = await colorService.createColor(req.body);
  res.status(201).json({
    success: true,
    data: color,
  });
});

// Cập nhật màu sắc (Admin)
exports.updateColor = asyncHandler(async (req, res) => {
  const color = await colorService.updateColor(req.params.id, req.body);
  res.json({
    success: true,
    data: color,
  });
});

// Xóa màu sắc (Admin)
exports.deleteColor = asyncHandler(async (req, res) => {
  await colorService.deleteColor(req.params.id);
  res.json({
    success: true,
    message: "Xóa màu sắc thành công",
  });
});

// Kiểm tra xem màu sắc có thể xóa được không
exports.checkDeletableColor = asyncHandler(async (req, res) => {
  try {
    const { colorId } = req.params;
    const result = await colorService.checkDeletableColor(colorId);
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

exports.getColorDetails = asyncHandler(async (req, res) => {
  const color = await colorService.getColorDetails(req.params.id);
  res.json({
    success: true,
    data: color,
  });
});
