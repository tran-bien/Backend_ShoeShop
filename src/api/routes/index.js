const express = require("express");
const router = express.Router();

// Public Routes
const authRoutes = require("@routes/public/auth.routes");
const userBrandRoutes = require("@routes/public/brand.routes");
const userCategoryRoutes = require("@routes/public/category.routes");
const publicTagRoutes = require("@routes/public/tag.routes");
const userProductRoutes = require("@routes/public/product.routes");
const productReviewRoutes = require("@routes/public/review.routes");
const publicReviewRoutes = require("@routes/public/reviews.routes");
const filterRoutes = require("@routes/public/filter.routes");
const publicCouponRoutes = require("@routes/public/coupon.routes");
const publicBannerRoutes = require("@routes/public/banner.routes");

// User Routes (Authenticated Users)
const userProfileRoutes = require("@routes/user/profile.routes");
const userWishlistRoutes = require("@routes/user/wishlist.routes");
const userCouponRoutes = require("@routes/user/coupon.routes");
const userReviewRoutes = require("@routes/user/review.routes");
const userOrderRoutes = require("@routes/user/order.routes");
const userCartRoutes = require("@routes/user/cart.routes");
const userImageRoutes = require("@routes/user/image.routes");

// Shipper Routes
const shipperRoutes = require("@routes/shipper.route");

// Admin/Staff Routes
const adminAuthRoutes = require("@routes/admin/auth.routes");
const adminDashboardRoutes = require("@routes/admin/dashboard.routes");
const inventoryRoutes = require("@routes/inventory.route");
const returnRoutes = require("@routes/return.route");
const adminOrderRoutes = require("@routes/admin/order.routes");
const adminUserRoutes = require("@routes/admin/user.routes");
const adminProductRoutes = require("@routes/admin/product.routes");
const adminVariantRoutes = require("@routes/admin/variant.routes");
const adminBrandRoutes = require("@routes/admin/brand.routes");
const adminCategoryRoutes = require("@routes/admin/category.routes");
const adminColorRoutes = require("@routes/admin/color.routes");
const adminSizeRoutes = require("@routes/admin/size.routes");
const adminTagRoutes = require("@routes/admin/tag.routes");
const adminCouponRoutes = require("@routes/admin/coupon.routes");
const adminReviewRoutes = require("@routes/admin/review.routes");
const adminBannerRoutes = require("@routes/admin/banner.routes");
const adminReportRoutes = require("@routes/admin/report.routes");
const adminImageRoutes = require("@routes/admin/image.routes");

// PUBLIC ROUTES (Không cần đăng nhập)
router.use("/auth", authRoutes);
router.use("/brands", userBrandRoutes);
router.use("/categories", userCategoryRoutes);
router.use("/tags", publicTagRoutes);
router.use("/products", userProductRoutes);
router.use("/products", productReviewRoutes);
router.use("/reviews", publicReviewRoutes);
router.use("/filters", filterRoutes);
router.use("/coupons", publicCouponRoutes);
router.use("/banners", publicBannerRoutes);

// USER ROUTES (Cần đăng nhập - role: user)
router.use("/users/profile", userProfileRoutes);
router.use("/users/wishlist", userWishlistRoutes);
router.use("/users/coupons", userCouponRoutes);
router.use("/users/reviews", userReviewRoutes);
router.use("/users/orders", userOrderRoutes);
router.use("/users/cart", userCartRoutes);
router.use("/users/images", userImageRoutes);
router.use("/users/returns", returnRoutes); // User tạo/xem yêu cầu đổi trả

// SHIPPER ROUTES (role: shipper)
router.use("/shipper", shipperRoutes);

// ADMIN/STAFF ROUTES (role: admin hoặc staff)
router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/dashboard", adminDashboardRoutes);
router.use("/admin/inventory", inventoryRoutes);
router.use("/admin/returns", returnRoutes); // Admin/Staff xử lý đổi trả
router.use("/admin/orders", adminOrderRoutes);
router.use("/admin/users", adminUserRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/variants", adminVariantRoutes);
router.use("/admin/brands", adminBrandRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/admin/colors", adminColorRoutes);
router.use("/admin/sizes", adminSizeRoutes);
router.use("/admin/tags", adminTagRoutes);
router.use("/admin/coupons", adminCouponRoutes);
router.use("/admin/reviews", adminReviewRoutes);
router.use("/admin/banners", adminBannerRoutes);
router.use("/admin/reports", adminReportRoutes);
router.use("/admin/images", adminImageRoutes);

module.exports = router;
