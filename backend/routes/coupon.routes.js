const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  createCoupon,
  getCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  collectCoupon,
} = require("../controllers/coupon.controller");

const router = express.Router();

// Routes cho admin
router.post("/", protect, admin, createCoupon);
router.get("/", protect, admin, getCoupons);
router.get("/:id", protect, admin, getCouponById);
router.put("/:id", protect, admin, updateCoupon);
router.delete("/:id", protect, admin, deleteCoupon);

// Routes cho user
router.post("/validate", protect, validateCoupon);
router.post("/collect", protect, collectCoupon);

module.exports = router;
