const express = require("express");
const router = express.Router();
const brandController = require("../controllers/brand.controller");
const { protect, admin } = require("../middlewares/auth.middleware");

// Route công khai - lấy tất cả thương hiệu
router.get("/", brandController.getBrands);

// Route công khai - lấy chi tiết thương hiệu
router.get("/:id", brandController.getBrandById);

// Routes cho Admin
router.post("/", protect, admin, brandController.createBrand);
router.put("/:id", protect, admin, brandController.updateBrand);
router.delete("/:id", protect, admin, brandController.deleteBrand);

module.exports = router;
