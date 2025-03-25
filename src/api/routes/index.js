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

// Sử dụng các routes cho người dùng
router.use("/auth", authRoutes);
router.use("/images", userImageRoutes);
router.use("/brands", userBrandRoutes);
router.use("/categories", userCategoryRoutes);

// router.use("/products", productRoutes);
// router.use("/categories", categoryRoutes);
// router.use("/brands", brandRoutes);
// router.use("/users", userRoutes);
// router.use("/orders", orderRoutes);
// router.use("/cart", cartRoutes);
// router.use("/reviews", reviewRoutes);
// router.use("/colors", colorRoutes);
// router.use("/sizes", sizeRoutes);
// router.use("/coupons", couponRoutes);
// router.use("/notifications", notificationRoutes);

// Sử dụng các routes cho admin
router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/images", adminImageRoutes);
router.use("/admin/brands", adminBrandRoutes);
router.use("/admin/categories", adminCategoryRoutes);
// router.use("/admin/products", adminProductRoutes);
// router.use("/admin/categories", adminCategoryRoutes);
// router.use("/admin/brands", adminBrandRoutes);
// router.use("/admin/users", adminUserRoutes);
// router.use("/admin/orders", adminOrderRoutes);

module.exports = router;
