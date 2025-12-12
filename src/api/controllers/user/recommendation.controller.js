const asyncHandler = require("express-async-handler");
const recommendationService = require("@services/recommendation.service");

const recommendationController = {
  /**
   * @route GET /api/users/recommendations
   * @desc Lấy sản phẩm đề xuất
   * @access Private
   */
  getRecommendations: asyncHandler(async (req, res) => {
    // Support cả 'algorithm' và 'type' params để tương thích FE
    const { algorithm, type } = req.query;

    // Map type -> algorithm nếu FE gửi type
    let finalAlgorithm = algorithm || "HYBRID";
    if (type && !algorithm) {
      const typeToAlgorithm = {
        personalized: "HYBRID",
        trending: "TRENDING",
        similar: "CONTENT_BASED",
        collaborative: "COLLABORATIVE",
      };
      finalAlgorithm = typeToAlgorithm[type] || "HYBRID";
    }

    const result = await recommendationService.getRecommendations(
      req.user._id,
      finalAlgorithm
    );

    // Transform products to Recommendation format for FE
    const recommendations = (result.products || []).map((product, index) => ({
      product,
      score: 10 - index,
      reason: getReasonText(finalAlgorithm, product),
      type: type || "personalized",
    }));

    console.log(
      `[RECOMMENDATION CONTROLLER] User ${req.user._id}, algorithm: ${finalAlgorithm}, products count: ${recommendations.length}`
    );

    // Return in format that FE expects (both formats for compatibility)
    return res.json({
      success: true,
      message: "Lấy gợi ý sản phẩm thành công",
      data: {
        recommendations,
        products: result.products || [],
      },
      fromCache: result.fromCache || false,
    });
  }),
};

// Helper function to generate recommendation reason text
function getReasonText(algorithm, product) {
  switch (algorithm) {
    case "COLLABORATIVE":
      return "Khách hàng tương tự đã mua";
    case "CONTENT_BASED":
      return `Dựa trên sở thích của bạn`;
    case "TRENDING":
      return "Đang được yêu thích";
    default:
      return product.brand?.name
        ? `Sản phẩm ${product.brand.name} dành cho bạn`
        : "Được đề xuất cho bạn";
  }
}

module.exports = recommendationController;
