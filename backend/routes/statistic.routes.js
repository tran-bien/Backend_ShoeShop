const express = require("express");
const router = express.Router();
const {
  getRevenueStatistics,
  getProductStatistics,
  getCustomerStatistics,
  getDashboardStatistics,
  getProfitStatistics,
  getCategoryStatistics,
  getPaymentMethodStatistics,
} = require("../controllers/statistic.controller");
const { protect, admin } = require("../middlewares/auth.middleware");

// Tất cả các route đều yêu cầu xác thực và quyền admin
router.use(protect);
router.use(admin);

// Routes thống kê
router.get("/dashboard", getDashboardStatistics);
router.get("/revenue", getRevenueStatistics);
router.get("/profit", getProfitStatistics);
router.get("/products", getProductStatistics);
router.get("/customers", getCustomerStatistics);
router.get("/categories", getCategoryStatistics);
router.get("/payment-methods", getPaymentMethodStatistics);

module.exports = router;
