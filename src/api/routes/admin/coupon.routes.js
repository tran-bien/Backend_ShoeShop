const express = require("express");
const { protect, admin } = require("@middlewares/auth.middleware");
const couponController = require("@controllers/admin/coupon.controller");
const couponValidator = require("@validators/coupon.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/v1/admin/coupons
 * @desc    Lấy danh sách mã giảm giá
 * @access  Admin
 */
router.get(
  "/",
  validate(couponValidator.validateGetCoupons),
  couponController.getAllCoupons
);

/**
 * @route   GET /api/v1/admin/coupons/:id
 * @desc    Lấy chi tiết mã giảm giá
 * @access  Admin
 */
router.get("/:id", protect, admin, couponController.getCouponById);

/**
 * @route   POST /api/v1/admin/coupons
 * @desc    Tạo mã giảm giá mới
 * @access  Admin
 */
router.post(
  "/",
  validate(couponValidator.validateCreateCoupon),
  couponController.createCoupon
);

/**
 * @route   PUT /api/v1/admin/coupons/:id
 * @desc    Cập nhật mã giảm giá
 * @access  Admin
 */
router.put(
  "/:id",
  validate(couponValidator.validateUpdateCoupon),
  couponController.updateCoupon
);

/**
 * @route   DELETE /api/v1/admin/coupons/:id
 * @desc    Xóa mã giảm giá
 * @access  Admin
 */
router.delete("/:id", couponController.deleteCoupon);

/**
 * @route   PATCH /api/v1/admin/coupons/:id/status
 * @desc    Cập nhật trạng thái mã giảm giá
 * @access  Admin
 */
router.patch(
  "/:id/status",
  validate(couponValidator.validateUpdateCouponStatus),
  couponController.updateCouponStatus
);

module.exports = router;
