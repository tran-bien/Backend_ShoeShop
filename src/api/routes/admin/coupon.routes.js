const express = require("express");
const { protect, admin } = require("../../middlewares/auth.middleware");
const {
  createCoupon,
  getCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  collectCoupon,
  verifyCoupon,
  getCouponUser,
} = require("../controllers/coupon.controller");

const router = express.Router();

// Routes cho tất cả người dùng (public) - không yêu cầu đăng nhập nhưng vẫn lấy thông tin user nếu có
router.get("/", getCouponUser);

// Routes cho admin
router.post("/", protect, admin, createCoupon);
router.get("/", protect, admin, getCoupons);
router.get("/:id", protect, admin, getCouponById);
router.put("/:id", protect, admin, updateCoupon);
router.delete("/:id", protect, admin, deleteCoupon);

// Routes cho user
router.post("/validate", protect, validateCoupon);
router.post("/verify", protect, verifyCoupon);
router.post("/collect", protect, collectCoupon);

module.exports = router;
