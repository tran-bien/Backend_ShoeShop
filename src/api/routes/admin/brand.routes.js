const express = require("express");
const router = express.Router();
const {
  getAllBrandsForUser,
  getBrandBySlugForUser,
  getAllBrandsForAdmin,
  getBrandBySlugForAdmin,
  getBrandByIdForAdmin,
  createBrand,
  updateBrand,
  deleteBrand,
  checkDeletableBrand,
  toggleActive,
} = require("../controllers/brand.controller");
const { protect, admin } = require("../../middlewares/auth.middleware");

// Route cho người dùng
router.get("/", getAllBrandsForUser);
router.get("/slug/:slug", getBrandBySlugForUser);

// Route cho admin
router.get("/admin", protect, admin, getAllBrandsForAdmin);
router.get("/admin/:id", protect, admin, getBrandByIdForAdmin);

// Routes cho Admin khác
router.use(protect);
router.use(admin);

router.post("/", createBrand);
router.put("/:id", updateBrand);
router.delete("/:id", deleteBrand);
router.get("/check-delete/:id", checkDeletableBrand);
router.patch("/:id/toggle", toggleActive);
router.get("/admin/slug/:slug", getBrandBySlugForAdmin);

module.exports = router;
