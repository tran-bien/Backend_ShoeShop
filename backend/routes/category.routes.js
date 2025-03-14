const express = require("express");
const router = express.Router();
const {
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  activateCategory,
  checkDeletableCategory,
  hideCategory,
  getCategoriesForUser,
  getCategoriesForAdmin,
} = require("../controllers/category.controller");
const { protect, admin } = require("../middlewares/auth.middleware");

// Route cho người dùng
router.get("/", getCategoriesForUser); // Lấy danh mục cho người dùng

// Route cho admin
router.get("/admin", protect, admin, getCategoriesForAdmin);

// Route công khai - lấy chi tiết danh mục
router.get("/:id", getCategoryById);

// Routes cho Admin
router.use(protect);
router.use(admin);

router.post("/", createCategory);
router.put("/:categoryId", updateCategory);
router.delete("/:categoryId", deleteCategory);
router.get("/check-delete/:categoryId", checkDeletableCategory);
router.put("/activate/:id", activateCategory);
router.put("/hide/:id", hideCategory);

module.exports = router;
