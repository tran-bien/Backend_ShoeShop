const asyncHandler = require("express-async-handler");
const productService = require("../../services/product.service");

// Lấy thông tin chi tiết sản phẩm
exports.getProductDetails = asyncHandler(async (req, res) => {
  const product = await productService.getProductDetails(req.params.id);
  res.json({
    success: true,
    data: product,
  });
});

// Tạo sản phẩm mới
exports.createProduct = async (req, res) => {
  try {
    const productData = req.body;
    const newProduct = await productService.createProduct(productData);
    res.status(201).json({
      success: true,
      data: newProduct,
    });
  } catch (error) {
    let message = error.message;

    // Xử lý lỗi E11000 (trùng slug)
    if (message.includes("E11000") && message.includes("slug")) {
      message = "Sản phẩm với slug này đã tồn tại";
    }
    // Xử lý lỗi validation từ Mongoose
    else if (message.includes("validation failed")) {
      const errorFields = {
        name: "Tên sản phẩm là bắt buộc",
        description: "Mô tả sản phẩm là bắt buộc",
        category: "Danh mục sản phẩm không hợp lệ",
        brand: "Thương hiệu sản phẩm không hợp lệ",
        price: "Giá sản phẩm là bắt buộc và phải là số dương",
        // Thêm các trường khác nếu cần
      };

      // Kiểm tra từng trường và lấy thông báo lỗi tương ứng
      for (const [field, errorMsg] of Object.entries(errorFields)) {
        if (message.includes(`${field}:`)) {
          message = errorMsg;
          break;
        }
      }

      // Nếu không khớp với bất kỳ trường nào
      if (message.includes("validation failed")) {
        message = "Dữ liệu sản phẩm không hợp lệ";
      }
    }

    res.status(400).json({
      success: false,
      message: message,
    });
  }
};

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

// Lấy danh sách sản phẩm
exports.getProducts = async (req, res) => {
  try {
    const result = await productService.getProducts(req.query);
    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        total: result.totalDocs,
        page: result.page,
        pages: result.totalPages,
        limit: result.limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy danh sách sản phẩm",
      error: error.message,
    });
  }
};

// Lấy sản phẩm theo slug
exports.getProductBySlug = async (req, res) => {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy sản phẩm",
      });
    }
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Lỗi khi lấy thông tin sản phẩm",
      error: error.message,
    });
  }
};

/**
 * @desc    Lấy tất cả sản phẩm cho người dùng
 * @route   GET /api/products
 * @access  Public
 */
exports.getProductsForUser = asyncHandler(async (req, res) => {
  try {
    const result = await productService.getProducts(req.query);
    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        total: result.totalDocs,
        page: result.page,
        pages: result.totalPages,
        limit: result.limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy danh sách sản phẩm",
    });
  }
});

/**
 * @desc    Lấy sản phẩm theo ID cho người dùng
 * @route   GET /api/products/:id
 * @access  Public
 */
exports.getProductByIdForUser = asyncHandler(async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy sản phẩm",
    });
  }
});

/**
 * @desc    Lấy sản phẩm theo slug cho người dùng
 * @route   GET /api/products/slug/:slug
 * @access  Public
 */
exports.getProductBySlugForUser = asyncHandler(async (req, res) => {
  try {
    const product = await productService.getProductBySlug(req.params.slug);
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy sản phẩm theo slug",
    });
  }
});

/**
 * @desc    Lấy sản phẩm liên quan cho người dùng
 * @route   GET /api/products/:id/related
 * @access  Public
 */
exports.getRelatedProductsForUser = asyncHandler(async (req, res) => {
  try {
    const products = await productService.getRelatedProducts(
      req.params.id,
      req.query
    );
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy sản phẩm liên quan",
    });
  }
});

/**
 * @desc    Lấy sản phẩm nổi bật cho người dùng
 * @route   GET /api/products/featured
 * @access  Public
 */
exports.getFeaturedProductsForUser = asyncHandler(async (req, res) => {
  try {
    const products = await productService.getFeaturedProducts(req.query);
    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi lấy sản phẩm nổi bật",
    });
  }
});

/**
 * @desc    Tìm kiếm và lọc sản phẩm cho người dùng
 * @route   GET /api/products/search
 * @access  Public
 */
exports.searchProductsForUser = asyncHandler(async (req, res) => {
  try {
    const result = await productService.searchAndFilter(req.query);
    res.status(200).json({
      success: true,
      data: result.docs,
      pagination: {
        total: result.totalDocs,
        page: result.page,
        pages: result.totalPages,
        limit: result.limit,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi tìm kiếm sản phẩm",
    });
  }
});

/**
 * @desc    Kiểm tra tình trạng sản phẩm
 * @route   GET /api/products/:id/availability
 * @access  Public
 */
exports.checkProductAvailabilityForUser = asyncHandler(async (req, res) => {
  try {
    const result = await productService.checkProductAvailability(req.params.id);

    // Chuyển đổi trạng thái tiếng Anh sang tiếng Việt cho người dùng
    let statusInVietnamese;
    switch (result.stockStatus) {
      case "in_stock":
        statusInVietnamese = "Còn hàng";
        break;
      case "low_stock":
        statusInVietnamese = "Sắp hết hàng";
        break;
      case "out_of_stock":
        statusInVietnamese = "Hết hàng";
        break;
      default:
        statusInVietnamese = "Không xác định";
    }

    res.status(200).json({
      success: true,
      data: {
        ...result,
        statusInVietnamese,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || "Lỗi khi kiểm tra tình trạng sản phẩm",
    });
  }
});
