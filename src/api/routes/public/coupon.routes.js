const express = require("express");
const couponController = require("@controllers/public/coupon.controller");
const router = express.Router();

/**
 * @route   GET /api/coupons/public
 * @desc    Lấy danh sách mã giảm giá công khai
 * @access  Public
 */
router.get("/public", couponController.getPublicCoupons);

module.exports = router;
