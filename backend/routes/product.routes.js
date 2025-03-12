const express = require("express");
const { protect, admin } = require("../middlewares/auth.middleware");
const {
  createProduct,
  getAllProducts,
  getProductDetails,
  updateProduct,
  deleteProduct,
  addProductImages,
  deleteProductImage,
  manageVariant,
  addVariantImages,
  deleteVariantImage,
  searchProducts,
  filterProducts,
  getRelatedProducts,
  getProductDetailsWithAvailability,
  manageVariants,
  getVariantByColorAndSize,
  checkProductAvailability,
} = require("../controllers/product.controller");
const {
  uploadMultiple,
  uploadSingle,
  handleUploadError,
} = require("../middlewares/upload.middleware");

const router = express.Router();

// Route dành cho người dùng
router.get("/products", getAllProducts);
router.get("/search", searchProducts);
router.get("/filter", filterProducts);
router.get("/:id", getProductDetails);
router.get("/:id/related", getRelatedProducts);
router.get("/:id/availability", checkProductAvailability);
router.get("/:id/variant", getVariantByColorAndSize);

// Route dành cho admin
router.use(protect, admin);

router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);
router.post("/:id/images", uploadMultiple, handleUploadError, addProductImages);
router.delete("/:id/image", deleteProductImage);

// Quản lý biến thể
router.put("/:id/variants", manageVariants);
router.post("/:id/variant", manageVariant);
router.put("/:id/variant/:variantId", manageVariant);
router.delete("/:id/variant/:variantId", manageVariant);
router.post(
  "/:id/variant/:variantId/images",
  uploadMultiple,
  handleUploadError,
  addVariantImages
);
router.delete("/:id/variant/:variantId/image", deleteVariantImage);

module.exports = router;
