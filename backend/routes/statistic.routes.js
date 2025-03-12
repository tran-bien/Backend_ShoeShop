const express = require("express");
const router = express.Router();
const {
  getRevenueStatistics,
  getProductStatistics,
  getCustomerStatistics,
  getDashboardStatistics,
} = require("../controllers/statistic.controller");
const { protect, admin } = require("../middlewares/auth.middleware");

// Tất cả các route đều yêu cầu xác thực và quyền admin
router.use(protect);
router.use(admin);

router.get("/revenue", getRevenueStatistics);
router.get("/products", getProductStatistics);
router.get("/customers", getCustomerStatistics);
router.get("/dashboard", getDashboardStatistics);

module.exports = router;
