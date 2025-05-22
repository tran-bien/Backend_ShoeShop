const asyncHandler = require("express-async-handler");
const couponService = require("@services/coupon.service");

/**
 * @desc    Lấy danh sách coupon công khai
 * @route   GET /api/coupons
 * @access  Private - User
 */
const getPublicCoupons = asyncHandler(async (req, res) => {
  const result = await couponService.getPublicCoupons(req.query);
  return res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * @desc    Lấy danh sách coupon đã thu thập của người dùng
 * @route   GET /api/coupons/collected
 * @access  Private - User
 */
const getUserCoupons = asyncHandler(async (req, res) => {
  const result = await couponService.getUserCoupons(req.user.id, req.query);
  return res.status(200).json({
    success: true,
    ...result,
  });
});

/**
 * @desc    Thu thập coupon
 * @route   POST /api/coupons/:id/collect
 * @access  Private - User
 */
const collectCoupon = asyncHandler(async (req, res) => {
  const result = await couponService.collectCoupon(req.user.id, req.params.id);
  return res.status(200).json({
    success: true,
    ...result,
  });
});

module.exports = {
  getPublicCoupons,
  getUserCoupons,
  collectCoupon,
};
