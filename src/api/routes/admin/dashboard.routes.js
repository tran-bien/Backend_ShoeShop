const express = require("express");
const router = express.Router();
const dashboardController = require("@controllers/admin/dashboard.controller");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/dashboard
 * @desc    Lấy dữ liệu dashboard
 * @access  Admin
 */
router.get("/", dashboardController.getDashboardData);

/**
 * @route   GET /api/admin/dashboard/revenue/daily
 * @desc    Lấy dữ liệu doanh thu theo ngày
 * @access  Admin
 */
router.get("/revenue/daily", dashboardController.getDailyRevenue);

/**
 * @route   GET /api/admin/dashboard/revenue/monthly
 * @desc    Lấy dữ liệu doanh thu theo tháng
 * @access  Admin
 */
router.get("/revenue/monthly", dashboardController.getMonthlyRevenue);

module.exports = router;




