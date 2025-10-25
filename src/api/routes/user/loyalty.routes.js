const express = require("express");
const router = express.Router();
const loyaltyController = require("@controllers/user/loyalty.controller");
const { protect } = require("@middlewares/auth.middleware");

router.use(protect);

/**
 * @route GET /api/users/loyalty/stats
 * @desc Lấy thống kê loyalty
 */
router.get("/stats", loyaltyController.getLoyaltyStats);

/**
 * @route GET /api/users/loyalty/transactions
 * @desc Lấy lịch sử giao dịch điểm
 */
router.get("/transactions", loyaltyController.getTransactions);

module.exports = router;

