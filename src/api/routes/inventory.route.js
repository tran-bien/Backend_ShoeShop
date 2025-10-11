const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventory.controller");
const {
  protect,
  requireStaffOrAdmin,
} = require("../middlewares/auth.middleware");
const validate = require("@utils/validatehelper");
const {
  validateStockIn,
  validateStockOut,
  validateAdjustStock,
  validateCalculatePrice,
  validateUpdateThreshold,
  validateGetInventory,
  validateGetTransactions,
  validateInventoryId,
} = require("../validators/inventory.validator");

// Tất cả routes yêu cầu đăng nhập và quyền Staff/Admin
router.use(protect, requireStaffOrAdmin);

/**
 * @route   GET /api/inventory
 * @desc    Lấy danh sách tồn kho
 * @access  Staff/Admin
 */
router.get(
  "/",
  validate(validateGetInventory),
  inventoryController.getInventoryList
);

/**
 * @route   GET /api/inventory/stats
 * @desc    Lấy thống kê kho hàng
 * @access  Staff/Admin
 */
router.get("/stats", inventoryController.getInventoryStats);

/**
 * @route   GET /api/inventory/transactions
 * @desc    Lấy lịch sử giao dịch kho
 * @access  Staff/Admin
 */
router.get(
  "/transactions",
  validate(validateGetTransactions),
  inventoryController.getTransactionHistory
);

/**
 * @route   GET /api/inventory/:id
 * @desc    Lấy chi tiết một mục tồn kho
 * @access  Staff/Admin
 */
router.get(
  "/:id",
  validate(validateInventoryId),
  inventoryController.getInventoryDetail
);

/**
 * @route   POST /api/inventory/stock-in
 * @desc    Nhập hàng vào kho
 * @access  Staff/Admin
 */
router.post(
  "/stock-in",
  validate(validateStockIn),
  inventoryController.stockIn
);

/**
 * @route   POST /api/inventory/stock-out
 * @desc    Xuất hàng khỏi kho
 * @access  Staff/Admin
 */
router.post(
  "/stock-out",
  validate(validateStockOut),
  inventoryController.stockOut
);

/**
 * @route   POST /api/inventory/adjust
 * @desc    Điều chỉnh số lượng tồn kho
 * @access  Staff/Admin
 */
router.post(
  "/adjust",
  validate(validateAdjustStock),
  inventoryController.adjustStock
);

/**
 * @route   POST /api/inventory/calculate-price
 * @desc    Tính toán giá bán từ giá vốn
 * @access  Staff/Admin
 */
router.post(
  "/calculate-price",
  validate(validateCalculatePrice),
  inventoryController.calculatePrice
);

/**
 * @route   PATCH /api/inventory/:id/low-stock-threshold
 * @desc    Cập nhật ngưỡng cảnh báo tồn kho thấp
 * @access  Staff/Admin
 */
router.patch(
  "/:id/low-stock-threshold",
  validate(validateUpdateThreshold),
  inventoryController.updateLowStockThreshold
);

module.exports = router;
