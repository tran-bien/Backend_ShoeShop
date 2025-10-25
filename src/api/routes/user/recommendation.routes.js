const express = require("express");
const router = express.Router();
const recommendationController = require("@controllers/user/recommendation.controller");
const { protect } = require("@middlewares/auth.middleware");

router.use(protect);

/**
 * @route GET /api/users/recommendations
 * @desc Lấy sản phẩm đề xuất cá nhân hóa
 * @query algorithm=HYBRID|COLLABORATIVE|CONTENT_BASED|TRENDING
 */
router.get("/", recommendationController.getRecommendations);

module.exports = router;

