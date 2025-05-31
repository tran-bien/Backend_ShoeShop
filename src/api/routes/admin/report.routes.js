const express = require("express");
const router = express.Router();
const reportController = require("@controllers/admin/report.controller");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/v1/admin/reports/dashboard
 * @desc    Thống kê tổng quan cho dashboard
 * @access  Admin
 */
router.get("/dashboard", reportController.getDashboardStats);

/**
 * @route   GET /api/v1/admin/reports/revenue
 * @desc    Báo cáo doanh thu
 * @access  Admin
 */
router.get("/revenue", reportController.getRevenueReport);

/**
 * @route   GET /api/v1/admin/reports/top-selling
 * @desc    Báo cáo sản phẩm bán chạy
 * @access  Admin
 */
router.get("/top-selling", reportController.getTopSellingProducts);

/**
 * @route   GET /api/v1/admin/reports/inventory
 * @desc    Báo cáo tồn kho
 * @access  Admin
 */
router.get("/inventory", reportController.getInventoryReport);

module.exports = router;
