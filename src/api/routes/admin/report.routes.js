const express = require("express");
const router = express.Router();
const reportController = require("@controllers/admin/report.controller");
const { protect, admin } = require("@middlewares/auth.middleware");

/**
 * @route   GET /api/admin/reports/dashboard
 * @desc    Thống kê tổng quan cho dashboard
 * @access  Admin
 */
router.get("/dashboard", protect, admin, reportController.getDashboardStats);

/**
 * @route   GET /api/admin/reports/revenue
 * @desc    Báo cáo doanh thu
 * @access  Admin
 */
router.get("/revenue", protect, admin, reportController.getRevenueReport);

/**
 * @route   GET /api/admin/reports/top-selling
 * @desc    Báo cáo sản phẩm bán chạy
 * @access  Admin
 */
router.get(
  "/top-selling",
  protect,
  admin,
  reportController.getTopSellingProducts
);

/**
 * @route   GET /api/admin/reports/inventory
 * @desc    Báo cáo tồn kho
 * @access  Admin
 */
router.get("/inventory", protect, admin, reportController.getInventoryReport);

module.exports = router;
