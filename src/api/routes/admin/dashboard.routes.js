const express = require("express");
const router = express.Router();
const dashboardController = require("@controllers/admin/dashboard.controller");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Lấy dữ liệu dashboard
 * @access  Admin
 */
router.get("/", dashboardController.getDashboardData);

/**
 * @route   GET /api/v1/admin/dashboard/revenue/daily
 * @desc    Lấy dữ liệu doanh thu theo ngày
 * @access  Admin
 */
router.get("/revenue/daily", dashboardController.getDailyRevenue);

/**
 * @route   GET /api/v1/admin/dashboard/revenue/monthly
 * @desc    Lấy dữ liệu doanh thu theo tháng
 * @access  Admin
 */
router.get("/revenue/monthly", dashboardController.getMonthlyRevenue);

/**
 * @route   GET /api/v1/admin/dashboard/top-selling-products
 * @desc    Lấy dữ liệu sản phẩm bán chạy nhất với các tham số truy vấn (period: 'week', 'month', 'year')
 * @access  Admin
 */
router.get("/top-selling-products", dashboardController.getTopSellingProducts);

module.exports = router;




