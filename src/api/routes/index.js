const express = require("express");
const router = express.Router();

// Import các routes
const authRoutes = require("@routes/public/auth.routes");
const adminAuthRoutes = require("@routes/admin/auth.routes");
const userImageRoutes = require("@routes/user/image.routes");
const adminImageRoutes = require("@routes/admin/image.routes");
const adminBrandRoutes = require("@routes/admin/brand.routes");
const adminCategoryRoutes = require("@routes/admin/category.routes");
const userBrandRoutes = require("@routes/public/brand.routes");
const userCategoryRoutes = require("@routes/public/category.routes");
const adminColorRoutes = require("@routes/admin/color.routes");
const adminSizeRoutes = require("@routes/admin/size.routes");
const adminProductRoutes = require("@routes/admin/product.routes");
const userProductRoutes = require("@routes/public/product.routes");
const adminVariantRoutes = require("@routes/admin/variant.routes");
const userVariantRoutes = require("@routes/public/variant.routes");
const filterRoutes = require("@routes/public/filter.routes");

// Routes người dùng
const userProfileRoutes = require("@routes/user/profile.routes");
const userWishlistRoutes = require("@routes/user/wishlist.routes");
const userCouponRoutes = require("@routes/user/coupon.routes");
const userReviewRoutes = require("@routes/user/review.routes");
const userOrderRoutes = require("@routes/user/order.routes");
const userCartRoutes = require("@routes/user/cart.routes");
const userNotificationRoutes = require("@routes/user/notification.routes");

// Routes admin
const adminUserRoutes = require("@routes/admin/user.routes");
const adminCouponRoutes = require("@routes/admin/coupon.routes");
const adminReviewRoutes = require("@routes/admin/review.routes");
const adminOrderRoutes = require("@routes/admin/order.routes");
const adminReportRoutes = require("@routes/admin/report.routes");

// Routes công khai
const publicCouponRoutes = require("@routes/public/coupon.routes");
const productReviewRoutes = require("@routes/public/review.routes");
const publicReviewRoutes = require("@routes/public/reviews.routes");

// Sử dụng các routes cho người dùng
router.use("/auth", authRoutes);
router.use("/images", userImageRoutes);
router.use("/brands", userBrandRoutes);
router.use("/categories", userCategoryRoutes);
router.use("/products", userProductRoutes);
router.use("/products", productReviewRoutes);
router.use("/reviews", publicReviewRoutes);
router.use("/filters", filterRoutes);
router.use("/coupons", publicCouponRoutes);
router.use("/cart", userCartRoutes);
router.use("/orders", userOrderRoutes);
router.use("/notifications", userNotificationRoutes);

// Thêm routes mới cho người dùng
router.use("/users", userProfileRoutes);
router.use("/users", userWishlistRoutes);
router.use("/users", userCouponRoutes);
router.use("/users", userReviewRoutes);

// Sử dụng các routes cho admin
router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/images", adminImageRoutes);
router.use("/admin/brands", adminBrandRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/admin/colors", adminColorRoutes);
router.use("/admin/sizes", adminSizeRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/variants", adminVariantRoutes);
router.use("/admin/orders", adminOrderRoutes);
router.use("/admin/reports", adminReportRoutes);
router.use("/admin/users", adminUserRoutes);
router.use("/admin/coupons", adminCouponRoutes);
router.use("/admin/reviews", adminReviewRoutes);

// Routes công khai
router.use("/variants", userVariantRoutes);

module.exports = router;
