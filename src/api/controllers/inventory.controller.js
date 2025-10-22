const inventoryService = require("../../services/inventory.service");

/**
 * Nhập hàng vào kho (manual)
 * Tính weighted average cost, generate SKU, update pricing
 * @access Staff/Admin
 * @route POST /api/v1/admin/inventory/stock-in
 */
const stockIn = async (req, res, next) => {
  try {
    const { productId, variantId, sizeId, quantity, costPrice, note } =
      req.body;

    const result = await inventoryService.stockIn({
      productId,
      variantId,
      sizeId,
      quantity,
      costPrice,
      note,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: "Nhập hàng thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Xuất hàng khỏi kho (manual)
 * Kiểm tra tồn kho, trừ số lượng
 * @access Staff/Admin
 * @route POST /api/v1/admin/inventory/stock-out
 */
const stockOut = async (req, res, next) => {
  try {
    const { productId, variantId, sizeId, quantity, note, orderId } = req.body;

    const result = await inventoryService.stockOut({
      productId,
      variantId,
      sizeId,
      quantity,
      note,
      orderId,
      createdBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Xuất hàng thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Điều chỉnh số lượng tồn kho (kiểm kê)
 * Đặt số lượng mới trực tiếp
 * @access Staff/Admin
 * @route POST /api/v1/admin/inventory/adjust
 */
const adjustStock = async (req, res, next) => {
  try {
    const { productId, variantId, sizeId, newQuantity, reason } = req.body;

    const result = await inventoryService.adjustStock({
      productId,
      variantId,
      sizeId,
      newQuantity,
      reason,
      createdBy: req.user._id,
    });

    res.status(200).json({
      success: true,
      message: "Điều chỉnh tồn kho thành công",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy danh sách tồn kho với filter
 * @access Staff/Admin
 * @route GET /api/v1/admin/inventory?page=1&limit=20&productId=...&lowStock=true
 */
const getInventoryList = async (req, res, next) => {
  try {
    const { page, limit, productId, lowStock, outOfStock, sortBy, sortOrder } =
      req.query;

    const result = await inventoryService.getInventoryList({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      productId,
      lowStock: lowStock === "true",
      outOfStock: outOfStock === "true",
      sortBy,
      sortOrder,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy chi tiết một InventoryItem
 * @access Staff/Admin
 * @route GET /api/v1/admin/inventory/:id
 */
const getInventoryDetail = async (req, res, next) => {
  try {
    const { id } = req.params;

    const inventory = await inventoryService.getInventoryById(id);

    res.status(200).json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy lịch sử giao dịch kho với filter chi tiết
 * Filter: type (IN/OUT/ADJUST), productId, variantId, sizeId, startDate, endDate
 * @access Staff/Admin
 * @route GET /api/v1/admin/inventory/transactions?type=IN&productId=...
 */
const getTransactionHistory = async (req, res, next) => {
  try {
    const {
      page,
      limit,
      productId,
      variantId,
      sizeId,
      type,
      startDate,
      endDate,
    } = req.query;

    const result = await inventoryService.getTransactionHistory({
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      productId,
      variantId,
      sizeId,
      type,
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lấy thống kê kho hàng cho dashboard
 * Returns: totalItems, lowStockItems, outOfStockItems, totalValue
 * @access Staff/Admin
 * @route GET /api/v1/admin/inventory/stats
 */
const getInventoryStats = async (req, res, next) => {
  try {
    const stats = await inventoryService.getInventoryStats();

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper API - Tính giá bán từ giá vốn (không lưu DB)
 * Returns: calculatedPrice, calculatedPriceFinal, profitPerItem, margin, markup
 * @access Staff/Admin
 * @route POST /api/v1/admin/inventory/calculate-price
 */
const calculatePrice = async (req, res, next) => {
  try {
    const { costPrice, targetProfitPercent, percentDiscount } = req.body;

    const priceInfo = inventoryService.calculatePrice(
      costPrice,
      targetProfitPercent,
      percentDiscount
    );

    res.status(200).json({
      success: true,
      data: priceInfo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cập nhật ngưỡng cảnh báo tồn kho thấp
 * @access Staff/Admin
 * @route PATCH /api/v1/admin/inventory/:id/low-stock-threshold
 */
const updateLowStockThreshold = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { lowStockThreshold } = req.body;

    const inventory = await inventoryService.updateLowStockThreshold(
      id,
      lowStockThreshold
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật ngưỡng cảnh báo thành công",
      data: inventory,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  stockIn,
  stockOut,
  adjustStock,
  getInventoryList,
  getInventoryDetail,
  getTransactionHistory,
  getInventoryStats,
  calculatePrice,
  updateLowStockThreshold,
};
