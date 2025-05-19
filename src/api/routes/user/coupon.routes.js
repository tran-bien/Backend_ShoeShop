const express = require("express");
const { isAuthenticated } = require("@middlewares/auth.middleware");
const couponController = require("@controllers/user/coupon.controller");
const validate = require("@utils/validatehelper");
const { validateCollectCoupon } = require("@validators/coupon.validator");

const router = express.Router();
// Middleware kiểm tra xác thực
router.use(isAuthenticated);
/**
 * @route   GET /api/users/coupons
 * @desc    Lấy danh sách mã giảm giá công khai
 * @access  Private - User
 */
router.get("/coupons", couponController.getPublicCoupons);

/**
 * @route   GET /api/users/coupons/collected
 * @desc    Lấy danh sách mã giảm giá đã thu thập của người dùng
 * @access  Private - User
 */
router.get("/coupons/collected", couponController.getUserCoupons);

/**
 * @route   POST /api/users/coupons/:id/collect
 * @desc    Thu thập mã giảm giá
 * @access  Private - User
 */
router.post(
  "/coupons/:id/collect",
  validate(validateCollectCoupon),
  couponController.collectCoupon
);

module.exports = router;
