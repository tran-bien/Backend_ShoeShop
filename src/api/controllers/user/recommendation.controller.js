const asyncHandler = require("express-async-handler");
const recommendationService = require("@services/recommendation.service");

const recommendationController = {
  /**
   * @route GET /api/users/recommendations
   * @desc Lấy sản phẩm đề xuất
   * @access Private
   */
  getRecommendations: asyncHandler(async (req, res) => {
    const { algorithm = "HYBRID" } = req.query;

    const result = await recommendationService.getRecommendations(
      req.user._id,
      algorithm
    );

    return res.json(result);
  }),
};

module.exports = recommendationController;

