const asyncHandler = require("express-async-handler");
const slugify = require("slugify");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const Color = require("../models/color.model");
const Size = require("../models/size.model");
const { uploadImage, deleteImage } = require("../utils/cloudinary");
const mongoose = require("mongoose");

//tìm kiếm
exports.searchProducts = asyncHandler(async (req, res) => {
  // Các tham số tìm kiếm và lọc
  const {
    keyword,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Kiểm tra vai trò của người dùng
  const isAdmin = req.user && req.user.role === "admin";

  if (!keyword) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp từ khóa tìm kiếm",
    });
  }

  // Tạo query tìm kiếm
  const query = {
    $or: [
      { name: { $regex: keyword, $options: "i" } },
      { description: { $regex: keyword, $options: "i" } },
    ],
  };

  // Nếu không phải admin, chỉ tìm các sản phẩm hoạt động và chưa bị xóa
  if (!isAdmin) {
    query.isActive = true;
    query.isDeleted = false;
  }

  // Tạo đối tượng sắp xếp
  const sort = {};
  sort[sortBy] = sortOrder === "asc" ? 1 : -1;

  // Tính toán phân trang
  const skip = (page - 1) * limit;

  // Thực hiện truy vấn với phân trang và sắp xếp
  const products = await Product.find(query)
    .select(
      "name slug price images totalQuantity stockStatus rating numReviews"
    )
    .populate("category", "name")
    .populate("brand", "name")
    .sort(sort)
    .skip(skip)
    .limit(Number(limit));

  // Đếm tổng số sản phẩm
  const total = await Product.countDocuments(query);

  // Format giá tiền sang đơn vị VND
  const formattedProducts = products.map((product) => {
    const formattedProduct = product.toObject();
    formattedProduct.formattedPrice = new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(product.price);
    return formattedProduct;
  });

  // Gợi ý sản phẩm (các sản phẩm có tên tương tự)
  const suggestions = await Product.find({
    isActive: true,
    isDeleted: false,
    name: { $regex: keyword, $options: "i" },
  })
    .select("name slug")
    .limit(5); // Giới hạn số lượng gợi ý

  res.status(200).json({
    success: true,
    data: {
      products: formattedProducts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      suggestions,
    },
  });
});

// Lọc sản phẩm theo các tiêu chí
exports.filterProducts = asyncHandler(async (req, res) => {
  const {
    category,
    brand,
    gender,
    minPrice,
    maxPrice,
    colors,
    sizes,
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Kiểm tra vai trò của người dùng
  const isAdmin = req.user && req.user.role === "admin";

  // Xây dựng query dựa trên vai trò
  const query = isAdmin ? {} : { isDeleted: false, isActive: true };

  // Thêm các điều kiện lọc
  if (category) query.category = category;
  if (brand) query.brand = brand;

  // Lọc theo giá
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }

  // Đếm tổng số sản phẩm tương ứng với query
  const total = await Product.countDocuments(query);

  // Xây dựng query sort
  const sortOptions = {};
  sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

  // Lấy danh sách sản phẩm theo trang
  let productsQuery = Product.find(query)
    .populate("category", "name")
    .populate("brand", "name")
    .sort(sortOptions)
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // Thực hiện query
  let products = await productsQuery;

  // Nếu có lọc theo màu, kích thước hoặc giới tính, cần kiểm tra từ bảng Variant
  if (colors || sizes || gender) {
    // Lấy tất cả sản phẩm trước
    const productIds = products.map((p) => p._id);

    // Xây dựng query cho variants
    const variantQuery = { product: { $in: productIds } };

    if (colors) {
      const colorArray = Array.isArray(colors) ? colors : [colors];
      variantQuery.color = { $in: colorArray };
    }

    if (sizes) {
      const sizeArray = Array.isArray(sizes) ? sizes : [sizes];
      variantQuery.size = { $in: sizeArray };
    }

    if (gender) {
      variantQuery.gender = gender;
    }

    // Tìm các biến thể phù hợp
    const validVariants = await Variant.find(variantQuery);

    // Lấy danh sách productId từ các biến thể hợp lệ
    const validProductIds = [
      ...new Set(validVariants.map((v) => v.product.toString())),
    ];

    // Lọc lại danh sách sản phẩm
    products = products.filter((p) =>
      validProductIds.includes(p._id.toString())
    );
  }

  res.status(200).json({
    success: true,
    data: {
      products,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    },
  });
});

// Lấy thông tin chi tiết sản phẩm cho cả admin và người dùng
exports.getProductDetails = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name")
    .populate("brand", "name");

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Kiểm tra xem người dùng có phải là admin hay không
  const isAdmin = req.user && req.user.role === "admin";

  // Nếu không phải admin và sản phẩm không hoạt động hoặc đã bị xóa
  if (!isAdmin && (product.isDeleted || !product.isActive)) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Lấy tất cả các biến thể của sản phẩm
  const variants = await Variant.find({ product: product._id })
    .populate("color", "name hexCode")
    .populate("size", "value description");

  // Nếu không phải admin, chỉ lấy các biến thể đang hoạt động
  const filteredVariants = isAdmin
    ? variants
    : variants.filter(
        (variant) => variant.status === "active" && variant.isAvailable
      );

  // Nhóm các biến thể theo màu sắc và giới tính để hiển thị
  const variantsByColorAndGender = {};
  filteredVariants.forEach((variant) => {
    const key = `${variant.color._id.toString()}-${variant.gender}`;
    if (!variantsByColorAndGender[key]) {
      variantsByColorAndGender[key] = {
        color: variant.color,
        gender: variant.gender,
        sizes: [],
        images:
          variant.imagesvariant && variant.imagesvariant.length > 0
            ? variant.imagesvariant
            : product.images,
      };
    }
    variantsByColorAndGender[key].sizes.push({
      size: variant.size,
      quantity: variant.quantity,
      variantId: variant._id,
      price: variant.price || product.price,
    });
  });

  // Chuyển đổi thành mảng để trả về client
  const colorGenderVariants = Object.values(variantsByColorAndGender);

  const response = {
    success: true,
    data: {
      product: {
        _id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        images: product.images,
        category: product.category,
        brand: product.brand,
        rating: product.rating,
        numReviews: product.numReviews,
      },
      variants: colorGenderVariants,
    },
  };

  // Nếu là admin, thêm thông tin bổ sung
  if (isAdmin) {
    response.data.additionalInfo = {
      isActive: product.isActive,
      isDeleted: product.isDeleted,
      costPrice: product.costPrice,
      profit: product.profit,
      profitPercentage: product.profitPercentage,
      totalQuantity: product.totalQuantity,
      stockStatus: product.stockStatus,
      totalSold: product.totalSoldproduct,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  res.status(200).json(response);
});

// Lấy thông tin chi tiết sản phẩm với thông tin khả dụng
exports.getProductDetailsWithAvailability = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name")
    .populate("brand", "name");

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Kiểm tra xem người dùng có phải là admin hay không
  const isAdmin = req.user && req.user.role === "admin";

  // Nếu không phải admin và sản phẩm không hoạt động hoặc đã bị xóa
  if (!isAdmin && (product.isDeleted || !product.isActive)) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Lấy tất cả các biến thể của sản phẩm
  const variants = await Variant.find({ product: product._id })
    .populate("color", "name hexCode")
    .populate("size", "value description");

  // Kiểm tra biến thể có sẵn
  const variantAvailability = variants.map((variant) => ({
    _id: variant._id,
    color: variant.color,
    size: variant.size,
    gender: variant.gender,
    quantity: variant.quantity,
    isAvailable:
      variant.isAvailable &&
      variant.status === "active" &&
      variant.quantity > 0,
    price: variant.price,
  }));

  // Nhóm các biến thể theo màu sắc và giới tính
  const variantsByColorAndGender = {};
  variants.forEach((variant) => {
    if (isAdmin || (variant.status === "active" && variant.isAvailable)) {
      const key = `${variant.color._id.toString()}-${variant.gender}`;
      if (!variantsByColorAndGender[key]) {
        variantsByColorAndGender[key] = {
          color: variant.color,
          gender: variant.gender,
          sizes: [],
          images:
            variant.imagesvariant && variant.imagesvariant.length > 0
              ? variant.imagesvariant
              : product.images,
        };
      }
      variantsByColorAndGender[key].sizes.push({
        size: variant.size,
        quantity: variant.quantity,
        variantId: variant._id,
        price: variant.price || product.price,
        isAvailable:
          variant.isAvailable &&
          variant.status === "active" &&
          variant.quantity > 0,
      });
    }
  });

  const response = {
    success: true,
    data: {
      product: {
        _id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        images: product.images,
        category: product.category,
        brand: product.brand,
        rating: product.rating,
        numReviews: product.numReviews,
        isAvailable: product.isActive && !product.isDeleted,
      },
      variants: Object.values(variantsByColorAndGender),
      variantAvailability: variantAvailability,
    },
  };

  res.status(200).json(response);
});

// Tạo sản phẩm mới
exports.createProduct = asyncHandler(async (req, res) => {
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

  if (!images || images.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp ít nhất một hình ảnh cho sản phẩm",
    });
  }

  if (!variants || variants.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng thêm ít nhất một biến thể cho sản phẩm",
    });
  }

  // Tạo slug từ tên sản phẩm
  const slug = slugify(name, {
    lower: true,
    locale: "vi",
    remove: /[*+~.()'"!:@]/g,
  });

  // Tạo sản phẩm
  const product = await Product.create({
    name,
    slug,
    description,
    price,
    costPrice,
    category,
    brand,
    images,
  });

  // Tạo các biến thể
  for (const variantData of variants) {
    // Kiểm tra dữ liệu giới tính
    if (
      !variantData.gender ||
      !["male", "female"].includes(variantData.gender)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Vui lòng chọn giới tính hợp lệ cho biến thể (male hoặc female)",
      });
    }

    // Tạo SKU nếu chưa có
    const sku =
      variantData.sku ||
      `${product._id.toString().slice(-6)}-${variantData.color
        .toString()
        .slice(-3)}-${variantData.size.toString().slice(-3)}`;

    await Variant.create({
      product: product._id,
      color: variantData.color,
      size: variantData.size,
      gender: variantData.gender,
      quantity: variantData.quantity || 0,
      status: variantData.status || "active",
      sku: sku,
      imagesvariant: variantData.images || [],
      price: variantData.price || product.price,
      costPrice: variantData.costPrice || product.costPrice,
      percentDiscount: variantData.percentDiscount || 0,
    });
  }

  // Cập nhật thông tin kho của sản phẩm
  await updateProductStock(product._id);

  // Lấy sản phẩm với thông tin đầy đủ
  const createdProduct = await Product.findById(product._id);

  res.status(201).json({
    success: true,
    data: createdProduct,
  });
});

// Cập nhật thông tin kho của sản phẩm
const updateProductStock = async (productId) => {
  const variants = await Variant.find({ product: productId, status: "active" });
  let totalQuantity = 0;

  variants.forEach((variant) => {
    if (variant.isAvailable) {
      totalQuantity += variant.quantity;
    }
  });

  let stockStatus = "outOfStock";
  if (totalQuantity > 0) {
    stockStatus = totalQuantity < 10 ? "lowStock" : "inStock";
  }

  await Product.findByIdAndUpdate(productId, {
    totalQuantity,
    stockStatus,
  });
};

// Cập nhật thông tin sản phẩm
exports.updateProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    price,
    costPrice,
    category,
    brand,
    gender,
    isActive,
    variants,
    colors,
  } = req.body;

  // Tìm sản phẩm cần cập nhật
  let product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Cập nhật slug nếu tên thay đổi
  if (name && name !== product.name) {
    const slug = slugify(name, { lower: true });

    // Kiểm tra xem slug đã tồn tại chưa (ngoại trừ sản phẩm hiện tại)
    const existingProduct = await Product.findOne({
      slug,
      _id: { $ne: req.params.id },
    });

    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Sản phẩm với tên này đã tồn tại",
      });
    }

    product.slug = slug;
  }

  // Cập nhật các trường
  if (name) product.name = name;
  if (description) product.description = description;
  if (price) product.price = price;
  if (costPrice) product.costPrice = costPrice;
  if (category) product.category = category;
  if (brand) product.brand = brand;
  if (gender) product.gender = gender;
  if (isActive !== undefined) product.isActive = isActive;

  // Cập nhật colors nếu được cung cấp
  if (colors) {
    product.colors = colors;
  }

  // Cập nhật variants nếu được cung cấp
  if (variants) {
    product.variants = variants;

    // Tính lại tổng số lượng
    const totalQuantity = variants.reduce(
      (total, v) => total + (v.status === "active" ? v.quantity : 0),
      0
    );

    // Cập nhật trạng thái kho
    if (totalQuantity === 0) {
      product.stockStatus = "outOfStock";
    } else if (totalQuantity < 10) {
      product.stockStatus = "lowStock";
    } else {
      product.stockStatus = "inStock";
    }

    // Cập nhật số lượng cho từng màu
    if (product.colors && product.colors.length > 0) {
      const colorQuantities = new Map();
      variants.forEach((v) => {
        if (v.status === "active") {
          const colorId = v.color.toString();
          const currentQty = colorQuantities.get(colorId) || 0;
          colorQuantities.set(colorId, currentQty + v.quantity);
        }
      });

      product.colors.forEach((c) => {
        const colorId = c.color.toString();
        c.quantity = colorQuantities.get(colorId) || 0;
      });
    }
  }

  // Tính toán lại lợi nhuận nếu giá hoặc giá gốc thay đổi
  if (price || costPrice) {
    product.profit = product.price - product.costPrice;
  }

  // Lưu sản phẩm đã cập nhật
  product = await product.save();

  res.status(200).json({
    success: true,
    data: product,
  });
});

// Xóa sản phẩm
exports.deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Thay vì xóa, đánh dấu sản phẩm là không còn hoạt động
  product.isActive = false;
  await product.save();

  res.status(200).json({
    success: true,
    data: {},
    message: "Sản phẩm đã được xóa thành công",
  });
});

// Thêm hình ảnh sản phẩm
exports.addProductImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error("Vui lòng cung cấp ít nhất một hình ảnh");
  }

  const { colorId } = req.body;

  if (!colorId) {
    res.status(400);
    throw new Error("Vui lòng chọn màu sắc cho hình ảnh");
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Không tìm thấy sản phẩm");
  }

  // Tìm màu sắc trong sản phẩm
  const colorIndex = product.colors.findIndex(
    (c) => c.color.toString() === colorId
  );

  if (colorIndex === -1) {
    res.status(404);
    throw new Error("Không tìm thấy màu sắc trong sản phẩm");
  }

  // Tải lên nhiều hình ảnh
  const uploadPromises = req.files.map((file) => uploadImage(file));
  const uploadedImages = await Promise.all(uploadPromises);

  // Thêm URLs hình ảnh đã tải lên vào mảng hình ảnh của màu sắc
  product.colors[colorIndex].images.push(...uploadedImages);

  // Lưu sản phẩm đã cập nhật
  await product.save();

  res.status(200).json({
    success: true,
    data: product.colors[colorIndex],
    message: "Hình ảnh đã được thêm thành công",
  });
});

// Quản lý kho hàng
exports.manageProductStock = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sizeId, colorId, quantity, action, status } = req.body;

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Tìm variant tương ứng
  let variant = product.variants.find(
    (v) => v.color.toString() === colorId && v.size.toString() === sizeId
  );

  // Nếu không tìm thấy và action là 'add' hoặc 'set', tạo mới
  if (!variant && (action === "add" || action === "set")) {
    // Kiểm tra xem color đã tồn tại trong product.colors chưa
    const colorExists = product.colors.some(
      (c) => c.color.toString() === colorId
    );

    // Nếu color chưa tồn tại, thêm vào
    if (!colorExists) {
      product.colors.push({
        color: colorId,
        images: [],
        quantity: 0,
      });
    }

    // Thêm variant mới
    product.variants.push({
      color: colorId,
      size: sizeId,
      quantity: 0,
      status: "active",
      isAvailable: false,
      lastRestocked: new Date(),
      sku: `${product._id.toString().slice(-6)}-${colorId.slice(
        -3
      )}-${sizeId.slice(-3)}`,
    });

    // Lấy variant vừa tạo
    variant = product.variants[product.variants.length - 1];
  } else if (!variant) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy biến thể sản phẩm này",
    });
  }

  // Cập nhật số lượng dựa trên action
  let oldQuantity = variant.quantity;

  if (action === "add") {
    variant.quantity += Number(quantity);
    variant.lastRestocked = new Date();
  } else if (action === "subtract") {
    if (variant.quantity < Number(quantity)) {
      return res.status(400).json({
        success: false,
        message: "Số lượng giảm không thể lớn hơn số lượng hiện tại",
      });
    }
    variant.quantity -= Number(quantity);
  } else if (action === "set") {
    variant.quantity = Number(quantity);
    variant.lastRestocked = new Date();
  }

  // Cập nhật trạng thái của biến thể
  if (status) {
    variant.status = status;
  }

  // Cập nhật trạng thái isAvailable dựa trên số lượng và trạng thái
  variant.isAvailable = variant.quantity > 0 && variant.status === "active";

  // Cập nhật tổng số lượng của sản phẩm và số lượng cho từng màu
  const totalQuantity = product.variants.reduce(
    (total, v) => total + (v.status === "active" ? v.quantity : 0),
    0
  );

  // Cập nhật số lượng cho từng màu
  const colorQuantities = new Map();
  product.variants.forEach((v) => {
    if (v.status === "active") {
      const colorId = v.color.toString();
      const currentQty = colorQuantities.get(colorId) || 0;
      colorQuantities.set(colorId, currentQty + v.quantity);
    }
  });

  // Cập nhật số lượng cho từng màu trong colors array
  product.colors.forEach((c) => {
    const colorId = c.color.toString();
    c.quantity = colorQuantities.get(colorId) || 0;
  });

  // Cập nhật trạng thái kho hàng của sản phẩm
  if (totalQuantity === 0) {
    product.stockStatus = "outOfStock";
  } else if (totalQuantity < 10) {
    product.stockStatus = "lowStock";
  } else {
    product.stockStatus = "inStock";
  }

  // Lưu sản phẩm đã cập nhật
  await product.save();

  res.status(200).json({
    success: true,
    message: "Đã cập nhật kho hàng thành công",
    data: {
      productId: product._id,
      variant: {
        color: variant.color,
        size: variant.size,
        quantity: variant.quantity,
        oldQuantity: oldQuantity,
        change: variant.quantity - oldQuantity,
        status: variant.status,
        isAvailable: variant.isAvailable,
      },
      productStatus: {
        totalQuantity: product.calculatedTotalQuantity,
        stockStatus: product.calculatedStockStatus,
      },
    },
  });
});

// Thêm hình ảnh cho biến thể
exports.addVariantImages = asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    res.status(400);
    throw new Error("Vui lòng cung cấp ít nhất một hình ảnh");
  }

  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error("Không tìm thấy sản phẩm");
  }

  const variantId = req.params.variantId;

  // Tìm variant trong sản phẩm
  const variantIndex = product.variants.findIndex(
    (v) => v._id.toString() === variantId
  );

  if (variantIndex === -1) {
    res.status(404);
    throw new Error("Không tìm thấy biến thể trong sản phẩm");
  }

  // Tải lên nhiều hình ảnh
  const uploadPromises = req.files.map((file) => uploadImage(file));
  const uploadedImages = await Promise.all(uploadPromises);

  // Khởi tạo mảng hình ảnh nếu chưa có
  if (!product.variants[variantIndex].imagesvariant) {
    product.variants[variantIndex].imagesvariant = [];
  }

  // Thêm URLs hình ảnh đã tải lên vào mảng hình ảnh của biến thể
  product.variants[variantIndex].imagesvariant.push(
    ...uploadedImages.map((url) => ({
      url,
      public_id: url.split("/").pop().split(".")[0],
      isMain: false,
      displayOrder: product.variants[variantIndex].imagesvariant.length,
    }))
  );

  // Lưu sản phẩm đã cập nhật
  await product.save();

  res.status(200).json({
    success: true,
    data: product.variants[variantIndex],
    message: "Hình ảnh đã được thêm thành công cho biến thể",
  });
});

// Thêm hàm deleteVariantImage nếu chưa có
exports.deleteVariantImage = asyncHandler(async (req, res) => {
  const { imageUrl } = req.body;
  const { id, variantId } = req.params;

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp URL hình ảnh cần xóa",
    });
  }

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Tìm variant
  const variant = await Variant.findById(variantId);
  if (!variant || !variant.imagesvariant) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy biến thể hoặc ảnh",
    });
  }

  // Tìm và xóa ảnh
  const imageIndex = variant.imagesvariant.findIndex(
    (img) => img.url === imageUrl
  );
  if (imageIndex === -1) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy hình ảnh",
    });
  }

  // Xóa từ Cloudinary
  await deleteImage(variant.imagesvariant[imageIndex].public_id);

  // Xóa khỏi mảng
  variant.imagesvariant.splice(imageIndex, 1);

  await variant.save();

  res.status(200).json({
    success: true,
    message: "Đã xóa ảnh biến thể thành công",
    data: variant,
  });
});

// Sắp xếp lại thứ tự hình ảnh
exports.reorderProductImages = asyncHandler(async (req, res) => {
  const { colorId, imageOrder } = req.body;

  if (!colorId || !imageOrder || !Array.isArray(imageOrder)) {
    res.status(400);
    throw new Error("Vui lòng cung cấp đầy đủ thông tin");
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error("Không tìm thấy sản phẩm");
  }

  // Tìm màu sắc trong sản phẩm
  const colorIndex = product.colors.findIndex(
    (c) => c.color.toString() === colorId
  );

  if (colorIndex === -1) {
    res.status(404);
    throw new Error("Không tìm thấy màu sắc trong sản phẩm");
  }

  // Kiểm tra xem mảng thứ tự có chứa đúng số lượng hình ảnh không
  if (imageOrder.length !== product.colors[colorIndex].images.length) {
    res.status(400);
    throw new Error("Mảng thứ tự không khớp với số lượng hình ảnh");
  }

  // Lưu trữ mảng hình ảnh hiện tại
  const currentImages = [...product.colors[colorIndex].images];

  // Sắp xếp lại hình ảnh theo thứ tự mới
  const newImages = imageOrder.map((index) => currentImages[index]);

  // Cập nhật mảng hình ảnh
  product.colors[colorIndex].images = newImages;

  // Lưu sản phẩm đã cập nhật
  await product.save();

  res.status(200).json({
    success: true,
    data: product.colors[colorIndex],
    message: "Thứ tự hình ảnh đã được cập nhật thành công",
  });
});

// Lấy sản phẩm liên quan
exports.getRelatedProducts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 4 } = req.query;

  // Tìm sản phẩm hiện tại
  const product = await Product.findById(id);
  if (!product) {
    res.status(404);
    throw new Error("Không tìm thấy sản phẩm");
  }

  // Tìm các sản phẩm cùng danh mục, không bao gồm sản phẩm hiện tại và phải hoạt động
  const relatedProducts = await Product.find({
    _id: { $ne: id },
    category: product.category,
    isDeleted: false,
    isActive: true,
  })
    .limit(Number(limit))
    .select("name price images rating category gender brand")
    .populate("category", "name")
    .populate("brand", "name");

  res.status(200).json({
    success: true,
    count: relatedProducts.length,
    data: relatedProducts,
  });
});

// Lấy tất cả sản phẩm cho admin và người dùng
exports.getAllProducts = asyncHandler(async (req, res) => {
  // Kiểm tra vai trò của người dùng
  const isAdmin = req.user && req.user.role === "admin";

  // Xây dựng query
  const query = isAdmin ? {} : { isDeleted: false, isActive: true };

  const products = await Product.find(query)
    .populate("category", "name")
    .populate("brand", "name")
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: products,
  });
});

// Lấy thông tin chi tiết sản phẩm và biến thể
exports.getVariantByColorAndSize = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

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

  // Tạo query để tìm biến thể
  const query = {
    product: product._id,
    color: colorId,
    size: sizeId,
  };

  // Thêm điều kiện giới tính nếu được cung cấp
  if (gender) {
    query.gender = gender;
  }

  const variant = await Variant.findOne(query)
    .populate("color", "name hexCode")
    .populate("size", "value description");

  if (!variant) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy biến thể cho màu sắc và kích thước này",
    });
  }

  res.status(200).json({
    success: true,
    data: variant, // Trả về biến thể
  });
});

// Kiểm tra tính khả dụng của sản phẩm
exports.checkProductAvailability = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Kiểm tra trạng thái sản phẩm
  if (product.isDeleted || !product.isActive) {
    return res.status(200).json({
      success: true,
      isAvailable: false,
    });
  }

  // Kiểm tra xem có biến thể nào khả dụng không
  const availableVariant = await Variant.findOne({
    product: product._id,
    status: "active",
    quantity: { $gt: 0 },
    isAvailable: true,
  });

  res.status(200).json({
    success: true,
    isAvailable: !!availableVariant,
  });
});

// Quản lý biến thể
exports.manageVariant = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { variantId } = req.params;
  const { action, data } = req.body;

  const product = await Product.findById(id);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Kiểm tra giới tính
  if (data && data.gender && !["male", "female"].includes(data.gender)) {
    return res.status(400).json({
      success: false,
      message: "Giới tính của biến thể phải là 'male' hoặc 'female'",
    });
  }

  let result;
  switch (action) {
    case "create":
      // Kiểm tra xem biến thể đã tồn tại chưa
      const existingVariant = await Variant.findOne({
        product: id,
        color: data.color,
        size: data.size,
        gender: data.gender,
      });

      if (existingVariant) {
        return res.status(400).json({
          success: false,
          message: "Biến thể này đã tồn tại",
        });
      }

      // Tạo SKU nếu chưa có
      const sku =
        data.sku ||
        `${id.slice(-6)}-${data.color.slice(-3)}-${data.size.slice(-3)}`;

      // Tạo biến thể mới
      result = await Variant.create({
        product: id,
        color: data.color,
        size: data.size,
        gender: data.gender,
        quantity: data.quantity || 0,
        status: data.status || "active",
        sku: sku,
        imagesvariant: data.images || [],
        price: data.price || product.price,
        costPrice: data.costPrice || product.costPrice,
        percentDiscount: data.percentDiscount || 0,
      });
      break;

    case "update":
      // Cập nhật biến thể
      result = await Variant.findByIdAndUpdate(variantId, data, { new: true });
      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy biến thể",
        });
      }
      break;

    case "delete":
      // Xóa biến thể
      result = await Variant.findByIdAndDelete(variantId);
      if (!result) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy biến thể",
        });
      }
      break;

    default:
      return res.status(400).json({
        success: false,
        message: "Hành động không hợp lệ",
      });
  }

  // Cập nhật thông tin kho của sản phẩm
  await updateProductStock(id);

  res.status(200).json({
    success: true,
    data: result,
  });
});

// Xóa hình ảnh sản phẩm
exports.deleteProductImage = asyncHandler(async (req, res) => {
  const { imageUrl } = req.body;

  if (!imageUrl) {
    return res.status(400).json({
      success: false,
      message: "Vui lòng cung cấp URL hình ảnh cần xóa",
    });
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy sản phẩm",
    });
  }

  // Tìm vị trí hình ảnh trong mảng
  const imageIndex = product.images.findIndex((img) => img.url === imageUrl);

  if (imageIndex === -1) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy hình ảnh",
    });
  }

  // Xóa hình ảnh từ Cloudinary
  await deleteImage(product.images[imageIndex].public_id);

  // Xóa URL hình ảnh khỏi mảng
  product.images.splice(imageIndex, 1);

  // Lưu sản phẩm đã cập nhật
  await product.save();

  res.status(200).json({
    success: true,
    data: product.images,
    message: "Hình ảnh đã được xóa thành công",
  });
});

// Quản lý nhiều biến thể
exports.manageVariants = asyncHandler(async (req, res) => {
  const { action, data } = req.body;
  const { id: productId } = req.params;

  // Xử lý actions (create/update/delete)
  // Thực hiện các thao tác với biến thể theo yêu cầu

  // Sau khi xử lý variant
  await updateProductStock(productId);

  // Trả về data mới với virtual fields
  const updatedProduct = await Product.findById(productId).populate(
    "variants.color variants.size"
  );

  res.json({
    success: true,
    data: {
      ...updatedProduct.toObject(),
      totalQuantity: updatedProduct.totalQuantity,
      stockStatus: updatedProduct.stockStatus,
    },
  });
});
