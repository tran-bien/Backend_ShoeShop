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
const userColorRoutes = require("@routes/public/color.routes");
const adminSizeRoutes = require("@routes/admin/size.routes");
const userSizeRoutes = require("@routes/public/size.routes");

// Sử dụng các routes cho người dùng
router.use("/auth", authRoutes);
router.use("/images", userImageRoutes);
router.use("/brands", userBrandRoutes);
router.use("/categories", userCategoryRoutes);
router.use("/colors", userColorRoutes);
router.use("/sizes", userSizeRoutes);

// Sử dụng các routes cho admin
router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/images", adminImageRoutes);
router.use("/admin/brands", adminBrandRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/admin/colors", adminColorRoutes);
router.use("/admin/sizes", adminSizeRoutes);

module.exports = router;
