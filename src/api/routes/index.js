const express = require("express");
const router = express.Router();

// Import các routes
const authRoutes = require("@routes/public/auth.routes");
const uploadRoutes = require("@routes/public/upload.routes");
// const userRoutes = require("@routes/user/index");
// const adminRoutes = require("@routes/admin/index");

// Sử dụng các routes cho người dùng
router.use("/auth", authRoutes);
router.use("/upload", uploadRoutes);
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
// router.use("/admin/products", adminProductRoutes);
// router.use("/admin/categories", adminCategoryRoutes);
// router.use("/admin/brands", adminBrandRoutes);
// router.use("/admin/users", adminUserRoutes);
// router.use("/admin/orders", adminOrderRoutes);

module.exports = router;
