const express = require("express");
const router = express.Router();
const viewHistoryController = require("@controllers/user/viewHistory.controller");
const { protect } = require("@middlewares/auth.middleware");

/**
 * @route POST /api/users/view-history
 * @desc Track product view (không cần login)
 */
router.post("/", viewHistoryController.trackView);

// Protected routes
router.use(protect);

/**
 * @route GET /api/users/view-history
 * @desc Lấy lịch sử xem
 */
router.get("/", viewHistoryController.getHistory);

/**
 * @route DELETE /api/users/view-history
 * @desc Xóa lịch sử
 */
router.delete("/", viewHistoryController.clearHistory);

module.exports = router;

