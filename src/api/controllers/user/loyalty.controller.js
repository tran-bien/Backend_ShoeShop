const asyncHandler = require("express-async-handler");
const loyaltyService = require("@services/loyalty.service");

const loyaltyController = {
  /**
   * @route GET /api/users/loyalty/stats
   * @desc Lấy thống kê loyalty của user
   * @access Private
   */
  getLoyaltyStats: asyncHandler(async (req, res) => {
    const result = await loyaltyService.getUserLoyaltyStats(req.user._id);

    return res.json(result);
  }),

  /**
   * @route GET /api/users/loyalty/transactions
   * @desc Lấy lịch sử giao dịch điểm
   * @access Private
   */
  getTransactions: asyncHandler(async (req, res) => {
    const result = await loyaltyService.getUserTransactions(
      req.user._id,
      req.query
    );

    return res.json(result);
  }),
};

module.exports = loyaltyController;

