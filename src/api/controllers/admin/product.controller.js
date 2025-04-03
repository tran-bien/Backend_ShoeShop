const asyncHandler = require("express-async-handler");
const productService = require("@services/product.service");

const productController = {
  /**
   * @desc    Lấy danh sách tất cả sản phẩm (có phân trang, lọc)
   * @route   GET /api/admin/products
   * @access  Admin
   */
  getAllProducts: asyncHandler(async (req, res) => {
    const result = await productService.getAdminProducts(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy chi tiết sản phẩm theo ID
   * @route   GET /api/admin/products/:id
   * @access  Admin
   */
  getProductById: asyncHandler(async (req, res) => {
    const result = await productService.getAdminProductById(req.params.id);
    res.json(result);
  }),

  /**
   * @desc    Tạo sản phẩm mới
   * @route   POST /api/admin/products
   * @access  Admin
   */
  createProduct: asyncHandler(async (req, res) => {
    const result = await productService.createProduct(req.body);
    res.status(201).json(result);
  }),

  /**
   * @desc    Cập nhật thông tin sản phẩm
   * @route   PUT /api/admin/products/:id
   * @access  Admin
   */
  updateProduct: asyncHandler(async (req, res) => {
    const result = await productService.updateProduct(req.params.id, req.body);
    res.json(result);
  }),

  /**
   * @desc    Xóa mềm sản phẩm
   * @route   DELETE /api/admin/products/:id
   * @access  Admin
   */
  deleteProduct: asyncHandler(async (req, res) => {
    const result = await productService.deleteProduct(
      req.params.id,
      req.user._id
    );
    res.json(result);
  }),

  /**
   * @desc    Lấy danh sách sản phẩm đã xóa
   * @route   GET /api/admin/products/deleted
   * @access  Admin
   */
  getDeletedProducts: asyncHandler(async (req, res) => {
    const result = await productService.getDeletedProducts(req.query);
    res.json(result);
  }),

  /**
   * @desc    Khôi phục sản phẩm đã xóa
   * @route   PUT /api/admin/products/:id/restore
   * @access  Admin
   */
  restoreProduct: asyncHandler(async (req, res) => {
    const result = await productService.restoreProduct(req.params.id);
    res.json(result);
  }),

  /**
   * @desc    Cập nhật trạng thái active của sản phẩm
   * @route   PATCH /api/admin/products/:id/status
   * @access  Admin
   */
  updateProductStatus: asyncHandler(async (req, res) => {
    const { isActive, cascade = true } = req.body;
    const result = await productService.updateProductStatus(
      req.params.id,
      isActive,
      cascade
    );
    res.json(result);
  }),

  /**
   * @desc    Cập nhật trạng thái tồn kho sản phẩm
   * @route   POST /api/admin/products/:id/update-stock-status
   * @access  Admin
   */
  updateProductStockStatus: asyncHandler(async (req, res) => {
    const result = await productService.updateProductStockStatus(req.params.id);
    res.json(result);
  }),
};

module.exports = productController;
