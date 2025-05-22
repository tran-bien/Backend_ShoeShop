const express = require("express");
const router = express.Router();
const productController = require("@controllers/admin/product.controller");
const productValidator = require("@validators/product.validator");
const validate = require("@utils/validatehelper");
const { protect, admin } = require("@middlewares/auth.middleware");

// Áp dụng middleware xác thực cho tất cả các routes
router.use(protect);
router.use(admin);

/**
 * @route   GET /api/admin/products
 * @desc    Lấy danh sách tất cả sản phẩm
 * @access  Admin
 */
router.get(
  "/",
  validate(productValidator.validateAdminProductQuery),
  productController.getAllProducts
);

/**
 * @route   GET /api/admin/products/deleted
 * @desc    Lấy danh sách sản phẩm đã xóa
 * @access  Admin
 */
router.get(
  "/deleted",
  validate(productValidator.validateAdminProductQuery),
  productController.getDeletedProducts
);

/**
 * @route   GET /api/admin/products/:id
 * @desc    Lấy chi tiết sản phẩm theo ID
 * @access  Admin
 */
router.get(
  "/:id",
  validate(productValidator.validateProductId),
  productController.getProductById
);

/**
 * @route   POST /api/admin/products
 * @desc    Tạo sản phẩm mới
 * @access  Admin
 */
router.post(
  "/",
  validate(productValidator.validateCreateProduct),
  productController.createProduct
);

/**
 * @route   PUT /api/admin/products/:id
 * @desc    Cập nhật thông tin sản phẩm
 * @access  Admin
 */
router.put(
  "/:id",
  validate(productValidator.validateUpdateProduct),
  productController.updateProduct
);

/**
 * @route   DELETE /api/admin/products/:id
 * @desc    Xóa mềm sản phẩm
 * @access  Admin
 */
router.delete(
  "/:id",
  validate(productValidator.validateProductId),
  productController.deleteProduct
);

/**
 * @route   PUT /api/admin/products/:id/restore
 * @desc    Khôi phục sản phẩm đã xóa
 * @access  Admin
 */
router.put(
  "/:id/restore",
  validate(productValidator.validateProductId),
  productController.restoreProduct
);

/**
 * @route   PATCH /api/admin/products/:id/status
 * @desc    Cập nhật trạng thái active của sản phẩm
 * @access  Admin
 */
router.patch(
  "/:id/status",
  validate(productValidator.validateStatusUpdate),
  productController.updateProductStatus
);

/**
 * @route   POST /api/admin/products/:id/update-stock-status
 * @desc    Cập nhật trạng thái tồn kho sản phẩm
 * @access  Admin
 */
router.post(
  "/:id/update-stock-status",
  validate(productValidator.validateProductId),
  productController.updateProductStockStatus
);

module.exports = router;
