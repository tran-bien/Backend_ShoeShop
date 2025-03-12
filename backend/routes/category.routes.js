const express = require("express");
const router = express.Router();
const categoryController = require("../controllers/category.controller");
const { protect, admin } = require("../middlewares/auth.middleware");

// Route công khai - lấy tất cả danh mục
router.get("/", categoryController.getCategories);

// Route công khai - lấy chi tiết danh mục
router.get("/:id", categoryController.getCategoryById);

// Routes cho Admin
router.post("/", protect, admin, categoryController.createCategory);
router.put("/:id", protect, admin, categoryController.updateCategory);
router.delete("/:id", protect, admin, categoryController.deleteCategory);

module.exports = router;
