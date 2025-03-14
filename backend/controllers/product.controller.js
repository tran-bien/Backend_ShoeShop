const asyncHandler = require("express-async-handler");
const productService = require("../services/product.service");

// Lấy thông tin chi tiết sản phẩm
exports.getProductDetails = asyncHandler(async (req, res) => {
  const product = await productService.getProductDetails(req.params.id);
  res.json({
    success: true,
    data: product,
  });
});

// Tạo sản phẩm mới
exports.createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  res.status(201).json({
    success: true,
    data: product,
  });
});

// Cập nhật thông tin sản phẩm
exports.updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  res.json({
    success: true,
    data: product,
  });
});

// Xóa sản phẩm
exports.deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  res.json({
    success: true,
    message: "Xóa sản phẩm thành công",
  });
});

// Thêm hình ảnh sản phẩm
exports.addProductImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new Error("Vui lòng cung cấp ít nhất một hình ảnh");
  }

  const updatedColor = await productService.addProductImages(
    req.params.id,
    req.body.colorId,
    req.files
  );

  res.status(200).json({
    success: true,
    data: updatedColor,
    message: "Hình ảnh đã được thêm thành công",
  });
});

// Quản lý kho hàng
exports.manageProductStock = asyncHandler(async (req, res) => {
  const result = await productService.manageProductStock(
    req.params.id,
    req.body
  );
  res.json({
    success: true,
    data: result,
  });
});

// Thêm hình ảnh cho biến thể
exports.addVariantImages = asyncHandler(async (req, res) => {
  const updatedVariant = await productService.addVariantImages(
    req.params.id,
    req.params.variantId,
    req.files
  );

  res.status(200).json({
    success: true,
    data: updatedVariant,
    message: "Hình ảnh đã được thêm thành công cho biến thể",
  });
});

// Xóa hình ảnh biến thể
exports.deleteVariantImage = asyncHandler(async (req, res) => {
  const updatedVariant = await productService.deleteVariantImage(
    req.params.id,
    req.params.variantId,
    req.body.imageUrl
  );

  res.status(200).json({
    success: true,
    data: updatedVariant,
    message: "Đã xóa ảnh biến thể thành công",
  });
});

// Sắp xếp lại thứ tự hình ảnh
exports.reorderProductImages = asyncHandler(async (req, res) => {
  const updatedColor = await productService.reorderProductImages(
    req.params.id,
    req.body.colorId,
    req.body.imageOrder
  );

  res.status(200).json({
    success: true,
    data: updatedColor,
    message: "Thứ tự hình ảnh đã được cập nhật thành công",
  });
});

// Lấy các sản phẩm liên quan
exports.getRelatedProducts = asyncHandler(async (req, res) => {
  const products = await productService.getRelatedProducts(
    req.params.id,
    req.query
  );
  res.json({
    success: true,
    data: products,
  });
});

// Lấy tất cả sản phẩm
exports.getAllProducts = asyncHandler(async (req, res) => {
  const isAdmin = req.user && req.user.role === "admin";
  const result = await productService.getAllProducts({ ...req.query, isAdmin });

  res.status(200).json(result);
});

// Kiểm tra tình trạng sản phẩm
exports.checkProductAvailability = asyncHandler(async (req, res) => {
  const result = await productService.checkProductAvailability(req.params.id);
  res.json({
    success: true,
    data: result,
  });
});

// Quản lý biến thể
exports.manageVariant = asyncHandler(async (req, res) => {
  const result = await productService.manageVariant(
    req.params.id,
    req.params.variantId,
    req.body.action,
    req.body.data
  );

  res.status(200).json({
    success: true,
    data: result.result,
    product: result.product,
  });
});

// Xóa hình ảnh sản phẩm
exports.deleteProductImage = asyncHandler(async (req, res) => {
  const updatedImages = await productService.deleteProductImage(
    req.params.id,
    req.body.imageUrl
  );

  res.status(200).json({
    success: true,
    data: updatedImages,
    message: "Hình ảnh đã được xóa thành công",
  });
});

// Quản lý nhiều biến thể
exports.manageVariants = asyncHandler(async (req, res) => {
  const updatedProduct = await productService.manageVariants(
    req.params.id,
    req.body.action,
    req.body.data
  );

  res.status(200).json({
    success: true,
    data: { product: updatedProduct },
  });
});

// Lấy sản phẩm nổi bật
exports.getFeaturedProducts = asyncHandler(async (req, res) => {
  const result = await productService.getFeaturedProducts(req.query);

  res.status(200).json(result);
});

// Thống kê hàng tồn kho
exports.getInventoryStats = asyncHandler(async (req, res) => {
  const stats = await productService.getInventoryStats(req.params.id);
  res.json({
    success: true,
    data: stats,
  });
});

// Gợi ý tìm kiếm
exports.getSearchSuggestions = asyncHandler(async (req, res) => {
  const suggestions = await productService.getSearchSuggestions(
    req.query.keyword
  );
  res.json({
    success: true,
    data: suggestions,
  });
});

// Tìm kiếm và lọc sản phẩm
exports.searchAndFilter = asyncHandler(async (req, res) => {
  const isAdmin = req.user && req.user.role === "admin";
  const result = await productService.searchAndFilter({
    ...req.query,
    isAdmin,
  });

  res.status(200).json(result);
});
