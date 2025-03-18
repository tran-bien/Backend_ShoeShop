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
  getCategoryByIdForUser,
  getCategoryBySlugForUser,
} = require("../../controllers/user/category.controller");
const { protect, admin } = require("../../middlewares/auth.middleware");

// Routes cho người dùng
router.get("/", getCategoriesForUser);
router.get("/slug/:slug", getCategoryBySlugForUser);
router.get("/:id", getCategoryByIdForUser);

// Route cho admin
router.get("/admin", protect, admin, getCategoriesForAdmin);

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
