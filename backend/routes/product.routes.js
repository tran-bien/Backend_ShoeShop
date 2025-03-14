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
  checkProductAvailability,
  deleteVariantImage,
  getRelatedProducts,
  manageVariants,
  getFeaturedProducts,
  getInventoryStats,
  getSearchSuggestions,
  searchAndFilter,
} = require("../controllers/product.controller");
const {
  uploadMultiple,
  uploadSingle,
  handleUploadError,
} = require("../middlewares/upload.middleware");

const router = express.Router();

// Route cho tất cả người dùng (public) - không yêu cầu đăng nhập nhưng vẫn lấy thông tin user nếu có
router.get("/products", getAllProducts);
router.get("/search-filter", searchAndFilter);
router.get("/suggestions", getSearchSuggestions);
router.get("/:id", getProductDetails);
router.get("/:id/related", getRelatedProducts);
router.get("/:id/availability", checkProductAvailability);

// Route dành cho user đã đăng nhập
// Các route liên quan đến mua hàng và đánh giá sẽ được thêm ở file cart.routes.js và review.routes.js

// Route dành cho admin
router.use(protect); // Tất cả các route dưới đây đều yêu cầu xác thực

// Chỉ admin mới có quyền tạo, cập nhật, xóa sản phẩm
router.post("/", admin, createProduct);
router.put("/:id", admin, updateProduct);
router.delete("/:id", admin, deleteProduct);
router.post(
  "/:id/images",
  admin,
  uploadMultiple,
  handleUploadError,
  addProductImages
);
router.delete("/:id/image", admin, deleteProductImage);

// Quản lý biến thể
router.put("/:id/variants", admin, manageVariants);
router.post("/:id/variant", admin, manageVariant);
router.put("/:id/variant/:variantId", admin, manageVariant);
router.delete("/:id/variant/:variantId", admin, manageVariant);
router.post(
  "/:id/variant/:variantId/images",
  admin,
  uploadMultiple,
  handleUploadError,
  addVariantImages
);

router.delete("/:id/variant/:variantId/image", admin, deleteVariantImage);

// Route cho API sản phẩm nổi bật
router.get("/featured", getFeaturedProducts);

// Route cho API thống kê hàng tồn kho
router.get("/:id/inventory-stats", protect, admin, getInventoryStats);

module.exports = router;
