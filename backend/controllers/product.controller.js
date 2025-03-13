const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const Product = require("../models/product.model");
const Color = require("../models/color.model");
const Size = require("../models/size.model");
const { uploadImage, deleteImage } = require("../utils/cloudinary");
const mongoose = require("mongoose");
const productService = require("../services/product.service");
const paginationService = require("../services/pagination.service");

// Lấy thông tin chi tiết sản phẩm cho cả admin và người dùng
exports.getProductDetails = asyncHandler(async (req, res) => {
  try {
    // Kiểm tra quyền
    const isAdmin = req.user && req.user.role === "admin";

    // Lấy chi tiết sản phẩm từ service
    const productData = await productService.getProductDetails(
      req.params.id,
      isAdmin
    );

    res.status(200).json({
      success: true,
      data: productData,
    });
  } catch (error) {
    res.status(error.message === "Sản phẩm không tồn tại" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi lấy thông tin sản phẩm",
    });
  }
});

// Tạo sản phẩm mới
exports.createProduct = asyncHandler(async (req, res) => {
  try {
    // Kiểm tra dữ liệu đầu vào
    const {
      name,
      description,
      price,
      costPrice,
      category,
      brand,
      variants,
      images,
    } = req.body;

    // Gọi service để tạo sản phẩm
    const createdProduct = await productService.createProduct({
      name,
      description,
      price,
      costPrice,
      category,
      brand,
      variants,
      images,
    });

    res.status(201).json({
      success: true,
      data: createdProduct,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Lỗi khi tạo sản phẩm",
    });
  }
});

// Cập nhật thông tin sản phẩm
exports.updateProduct = asyncHandler(async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      costPrice,
      category,
      brand,
      isActive,
      variants,
    } = req.body;

    // Gọi service để cập nhật sản phẩm
    const updatedProduct = await productService.updateProduct(req.params.id, {
      name,
      description,
      price,
      costPrice,
      category,
      brand,
      isActive,
      variants,
    });

    res.status(200).json({
      success: true,
      data: updatedProduct,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy sản phẩm" ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật sản phẩm",
    });
  }
});

// Xóa sản phẩm
exports.deleteProduct = asyncHandler(async (req, res) => {
  try {
    // Gọi service để xóa sản phẩm
    await productService.deleteProduct(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
      message: "Sản phẩm đã được xóa thành công",
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy sản phẩm" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi xóa sản phẩm",
    });
  }
});

// Thêm hình ảnh sản phẩm
exports.addProductImages = asyncHandler(async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400);
      throw new Error("Vui lòng cung cấp ít nhất một hình ảnh");
    }

    const { colorId } = req.body;

    // Gọi service để thêm hình ảnh sản phẩm
    const updatedColor = await productService.addProductImages(
      req.params.id,
      colorId,
      req.files
    );

    res.status(200).json({
      success: true,
      data: updatedColor,
      message: "Hình ảnh đã được thêm thành công",
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi thêm hình ảnh sản phẩm",
    });
  }
});

// Quản lý kho hàng
exports.manageProductStock = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { sizeId, colorId, quantity, action, status } = req.body;

    // Gọi service để quản lý kho hàng
    const result = await productService.manageProductStock(id, {
      sizeId,
      colorId,
      quantity,
      action,
      status,
    });

    res.status(200).json({
      success: true,
      message: "Đã cập nhật kho hàng thành công",
      data: result,
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi cập nhật kho hàng",
    });
  }
});

// Thêm hình ảnh cho biến thể
exports.addVariantImages = asyncHandler(async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      res.status(400);
      throw new Error("Vui lòng cung cấp ít nhất một hình ảnh");
    }

    // Gọi service để thêm hình ảnh cho biến thể
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
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi thêm hình ảnh biến thể",
    });
  }
});

// Xóa hình ảnh biến thể
exports.deleteVariantImage = asyncHandler(async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const { id, variantId } = req.params;

    // Gọi service để xóa hình ảnh biến thể
    const updatedVariant = await productService.deleteVariantImage(
      id,
      variantId,
      imageUrl
    );

    res.status(200).json({
      success: true,
      message: "Đã xóa ảnh biến thể thành công",
      data: updatedVariant,
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi xóa hình ảnh biến thể",
    });
  }
});

// Sắp xếp lại thứ tự hình ảnh
exports.reorderProductImages = asyncHandler(async (req, res) => {
  try {
    const { colorId, imageOrder } = req.body;

    // Gọi service để sắp xếp lại thứ tự hình ảnh
    const updatedColor = await productService.reorderProductImages(
      req.params.id,
      colorId,
      imageOrder
    );

    res.status(200).json({
      success: true,
      data: updatedColor,
      message: "Thứ tự hình ảnh đã được cập nhật thành công",
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi sắp xếp hình ảnh",
    });
  }
});

// Lấy các sản phẩm liên quan
exports.getRelatedProducts = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 5 } = req.query;

    // Kiểm tra quyền
    const isAdmin = req.user && req.user.role === "admin";

    // Lấy sản phẩm liên quan từ service
    const relatedProducts = await productService.getRelatedProducts(
      id,
      { limit },
      isAdmin
    );

    // Format dữ liệu sản phẩm
    const formattedProducts = productService.formatProductsForResponse(
      relatedProducts,
      isAdmin
    );

    res.status(200).json({
      success: true,
      count: formattedProducts.length,
      data: formattedProducts,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy sản phẩm" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi lấy sản phẩm liên quan",
    });
  }
});

// Lấy tất cả sản phẩm cho admin và người dùng
exports.getAllProducts = asyncHandler(async (req, res) => {
  try {
    // Kiểm tra quyền
    const isAdmin = req.user && req.user.role === "admin";

    // Thêm thông tin admin vào query
    const queryParams = { ...req.query, isAdmin };

    // Gọi service để lấy danh sách sản phẩm có phân trang
    const result = await productService.getAllProducts(queryParams);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách sản phẩm",
      error: error.message,
    });
  }
});

// Kiểm tra tình trạng sản phẩm còn hàng hay không
exports.checkProductAvailability = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Lấy thông tin về tình trạng sản phẩm từ service
    const availabilityInfo = await productService.checkProductAvailability(id);

    res.status(200).json({
      success: true,
      ...availabilityInfo,
    });
  } catch (error) {
    res.status(error.message === "Không tìm thấy sản phẩm" ? 404 : 500).json({
      success: false,
      message: error.message || "Lỗi khi kiểm tra tình trạng sản phẩm",
    });
  }
});

// DEPRECATED: Không còn sử dụng - Thay thế bằng getProductDetails
// Lưu lại để đảm bảo tương thích ngược với các ứng dụng cũ
exports.getVariantByColorAndSize = asyncHandler(async (req, res) => {
  console.log(
    "[DEPRECATED] getVariantByColorAndSize được gọi. Vui lòng sử dụng getProductDetails thay thế."
  );

  const product = await Product.findById(req.params.id)
    .populate("variants.color", "name hexCode")
    .populate("variants.sizes.size", "value description");

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  const { colorId, sizeId, gender } = req.query; // Lấy colorId, sizeId và gender từ query params

  if (!colorId || !sizeId) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp đầy đủ thông tin màu sắc và kích thước",
    });
  }

  // Sử dụng phương thức findVariant từ model Product
  const variantResult = product.findVariant(colorId, sizeId);

  if (!variantResult) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy biến thể với màu sắc và kích thước này",
    });
  }

  // Lọc theo gender nếu được cung cấp
  if (gender && variantResult.gender !== gender) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy biến thể phù hợp với giới tính yêu cầu",
    });
  }

  res.status(200).json({
    success: true,
    data: variantResult,
    deprecationNotice:
      "API này sẽ bị loại bỏ trong phiên bản tiếp theo. Vui lòng sử dụng getProductDetails thay thế.",
  });
});

// Quản lý biến thể
exports.manageVariant = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { variantId } = req.params;
    const { action, data } = req.body;

    // Gọi service để quản lý biến thể
    const result = await productService.manageVariant(
      id,
      variantId,
      action,
      data
    );

    res.status(200).json({
      success: true,
      data: result.result,
      product: result.product,
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi quản lý biến thể",
    });
  }
});

// Xóa hình ảnh sản phẩm
exports.deleteProductImage = asyncHandler(async (req, res) => {
  try {
    const { imageUrl } = req.body;

    // Gọi service để xóa hình ảnh sản phẩm
    const updatedImages = await productService.deleteProductImage(
      req.params.id,
      imageUrl
    );

    res.status(200).json({
      success: true,
      data: updatedImages,
      message: "Hình ảnh đã được xóa thành công",
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi xóa hình ảnh sản phẩm",
    });
  }
});

// Quản lý nhiều biến thể
exports.manageVariants = asyncHandler(async (req, res) => {
  try {
    const { action, data } = req.body;
    const { id: productId } = req.params;

    // Gọi service để quản lý biến thể
    const updatedProduct = await productService.manageVariants(
      productId,
      action,
      data
    );

    res.json({
      success: true,
      data: {
        product: updatedProduct,
      },
    });
  } catch (error) {
    res.status(error.message.includes("Không tìm thấy") ? 404 : 400).json({
      success: false,
      message: error.message || "Lỗi khi quản lý biến thể",
    });
  }
});

// API lấy sản phẩm nổi bật
exports.getFeaturedProducts = asyncHandler(async (req, res) => {
  try {
    // Gọi service để lấy sản phẩm nổi bật với phân trang
    const result = await productService.getFeaturedProducts(req.query);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy sản phẩm nổi bật",
      error: error.message,
    });
  }
});

// API thống kê hàng tồn kho
exports.getInventoryStats = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;

    // Lấy thống kê từ service
    const stats = await productService.getInventoryStats(id);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thống kê tồn kho",
      error: error.message,
    });
  }
});

// API gợi ý tìm kiếm
exports.getSearchSuggestions = asyncHandler(async (req, res) => {
  try {
    const { keyword, limit = 5 } = req.query;

    if (!keyword || keyword.trim().length < 2) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Lấy gợi ý từ service
    const suggestions = await productService.getSearchSuggestions(keyword, {
      limit,
    });

    res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy gợi ý tìm kiếm",
      error: error.message,
    });
  }
});

// API tìm kiếm và lọc kết hợp
exports.searchAndFilter = asyncHandler(async (req, res) => {
  try {
    // Kiểm tra quyền
    const isAdmin = req.user && req.user.role === "admin";

    // Thêm thông tin admin vào query
    const queryParams = { ...req.query, isAdmin };

    // Gọi service để tìm kiếm và lọc sản phẩm
    const result = await productService.searchAndFilter(queryParams);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm và lọc sản phẩm",
      error: error.message,
    });
  }
});
