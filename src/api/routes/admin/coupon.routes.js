const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const couponController = require("@controllers/admin/coupon.controller");
const couponValidator = require("@validators/coupon.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/admin/coupons
 * @desc    Lấy danh sách mã giảm giá
 * @access  Admin
 */
router.get(
  "/",
  protect,
  admin,
  validate(couponValidator.validateGetCoupons),
  couponController.getAllCoupons
);

/**
 * @route   GET /api/admin/coupons/:id
 * @desc    Lấy chi tiết mã giảm giá
 * @access  Admin
 */
router.get("/:id", protect, admin, couponController.getCouponById);

/**
 * @route   POST /api/admin/coupons
 * @desc    Tạo mã giảm giá mới
 * @access  Admin
 */
router.post(
  "/",
  protect,
  admin,
  validate(couponValidator.validateCreateCoupon),
  couponController.createCoupon
);

/**
 * @route   PUT /api/admin/coupons/:id
 * @desc    Cập nhật mã giảm giá
 * @access  Admin
 */
router.put(
  "/:id",
  protect,
  admin,
  validate(couponValidator.validateUpdateCoupon),
  couponController.updateCoupon
);

/**
 * @route   DELETE /api/admin/coupons/:id
 * @desc    Xóa mã giảm giá
 * @access  Admin
 */
router.delete("/:id", protect, admin, couponController.deleteCoupon);

/**
 * @route   PATCH /api/admin/coupons/:id/status
 * @desc    Cập nhật trạng thái mã giảm giá
 * @access  Admin
 */
router.patch(
  "/:id/status",
  protect,
  admin,
  validate(couponValidator.validateUpdateCouponStatus),
  couponController.updateCouponStatus
);

module.exports = router;
