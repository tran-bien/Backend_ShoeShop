const express = require("express");
const { isAuthenticated } = require("@middlewares/auth.middleware");
const couponController = require("@controllers/user/coupon.controller");
const validate = require("@utils/validatehelper");
const { validateCollectCoupon } = require("@validators/coupon.validator");

const router = express.Router();
// Middleware kiểm tra xác thực
router.use(isAuthenticated);
/**
 * @route   GET /api/coupons
 * @desc    Lấy danh sách mã giảm giá công khai
 * @access  Private - User
 */
router.get("/", couponController.getPublicCoupons);

/**
 * @route   GET /api/coupons/collected
 * @desc    Lấy danh sách mã giảm giá đã thu thập của người dùng
 * @access  Private - User
 */
router.get("/collected", couponController.getUserCoupons);

/**
 * @route   POST /api/coupons/:id/collect
 * @desc    Thu thập mã giảm giá
 * @access  Private - User
 */
router.post(
  "/:id/collect",
  validate(validateCollectCoupon),
  couponController.collectCoupon
);

module.exports = router;
