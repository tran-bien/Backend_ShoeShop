const asyncHandler = require("express-async-handler");
const inventoryService = require("../services/inventory.service");

// Lấy danh sách biến thể sản phẩm (kho)
exports.getInventory = asyncHandler(async (req, res) => {
  try {
    // Gọi service để lấy danh sách biến thể
    const result = await inventoryService.getInventory(req.query);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Lỗi khi lấy danh sách kho hàng: ${error.message}`,
    });
  }
});

// Lấy chi tiết một biến thể
exports.getInventoryItem = asyncHandler(async (req, res) => {
  try {
    const { id, colorId, sizeId } = req.params;

    // Gọi service để lấy chi tiết biến thể
    const result = await inventoryService.getInventoryItem(id, colorId, sizeId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thông tin biến thể",
    });
  }
});

// Thống kê kho
exports.getInventoryStats = asyncHandler(async (req, res) => {
  try {
    // Gọi service để lấy thống kê kho
    const stats = await inventoryService.getInventoryStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Lỗi khi lấy thống kê kho hàng: ${error.message}`,
    });
  }
});

// Cập nhật thông tin biến thể
exports.updateInventoryItem = asyncHandler(async (req, res) => {
  try {
    const { id, colorId, sizeId } = req.params;
    const updateData = {
      quantity: req.body.quantity,
      status: req.body.status,
      sku: req.body.sku,
    };

    // Gọi service để cập nhật biến thể
    const result = await inventoryService.updateInventoryItem(
      id,
      colorId,
      sizeId,
      updateData,
      req.user._id
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật thành công",
      data: result,
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật biến thể",
    });
  }
});

// Cập nhật số lượng hàng loạt
exports.bulkUpdateInventory = asyncHandler(async (req, res) => {
  try {
    const { items } = req.body;

    // Gọi service để cập nhật hàng loạt
    const result = await inventoryService.bulkUpdateInventory(
      items,
      req.user._id
    );

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Lỗi khi cập nhật hàng loạt: ${error.message}`,
    });
  }
});

// Lấy thống kê tồn kho theo màu sắc và kích thước
exports.getInventoryStatsByColorAndSize = asyncHandler(async (req, res) => {
  try {
    const { productId } = req.query;

    // Gọi service để lấy thống kê
    const stats = await inventoryService.getInventoryStatsByColorAndSize(
      productId
    );

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thống kê tồn kho",
    });
  }
});

module.exports = exports;
