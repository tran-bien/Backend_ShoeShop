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
const filterRoutes = require("@routes/public/filter.routes");

// Sử dụng các routes cho người dùng
router.use("/auth", authRoutes);
router.use("/images", userImageRoutes);
router.use("/brands", userBrandRoutes);
router.use("/categories", userCategoryRoutes);
router.use("/products", userProductRoutes);
router.use("/filters", filterRoutes);

// Sử dụng các routes cho admin
router.use("/admin/auth", adminAuthRoutes);
router.use("/admin/images", adminImageRoutes);
router.use("/admin/brands", adminBrandRoutes);
router.use("/admin/categories", adminCategoryRoutes);
router.use("/admin/colors", adminColorRoutes);
router.use("/admin/sizes", adminSizeRoutes);
router.use("/admin/products", adminProductRoutes);
router.use("/admin/variants", adminVariantRoutes);

module.exports = router;
