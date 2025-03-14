const Product = require("../models/product.model");
const paginationService = require("./pagination.service");
const Color = require("../models/color.model");
const Size = require("../models/size.model");
const mongoose = require("mongoose");

const productService = {
  /**
   * Thêm hình ảnh cho sản phẩm
   * @param {String} productId - ID sản phẩm
   * @param {String} colorId - ID màu sắc
   * @param {Array} files - Các file hình ảnh
   * @returns {Object} - Thông tin màu sắc đã cập nhật
   */
  addProductImages: async (productId, colorId, files) => {
    if (!files || files.length === 0) {
      throw new Error("Vui lòng cung cấp ít nhất một hình ảnh");
    }

    if (!colorId) {
      throw new Error("Vui lòng chọn màu sắc cho hình ảnh");
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Tìm màu sắc trong sản phẩm
    const colorIndex = product.colors.findIndex(
      (c) => c.color.toString() === colorId
    );

    if (colorIndex === -1) {
      throw new Error("Không tìm thấy màu sắc trong sản phẩm");
    }

    // Tải lên nhiều hình ảnh sử dụng hàm uploadImage từ cloudinary.js
    const { uploadImage } = require("../utils/cloudinary");
    const uploadPromises = files.map((file) => uploadImage(file));
    const uploadedImages = await Promise.all(uploadPromises);

    // Thêm URLs hình ảnh đã tải lên vào mảng hình ảnh của màu sắc
    product.colors[colorIndex].images.push(...uploadedImages);

    // Lưu sản phẩm đã cập nhật
    await product.save();

    return product.colors[colorIndex];
  },

  /**
   * Tạo sản phẩm mới
   * @param {Object} productData - Dữ liệu sản phẩm
   * @returns {Object} - Thông tin sản phẩm đã tạo
   */
  createProduct: async (productData) => {
    const { name, description, category, brand } = productData;

    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error("Tên sản phẩm không được để trống");
    }

    if (!description || description.trim().length === 0) {
      throw new Error("Mô tả sản phẩm không được để trống");
    }

    if (!category || !mongoose.Types.ObjectId.isValid(category)) {
      throw new Error("Danh mục sản phẩm không hợp lệ");
    }

    if (!brand || !mongoose.Types.ObjectId.isValid(brand)) {
      throw new Error("Thương hiệu sản phẩm không hợp lệ");
    }

    const product = new Product(productData);

    try {
      await product.save();
    } catch (error) {
      console.error("Error saving product:", error); // In ra lỗi chi tiết

      // Cải thiện cách bắt lỗi trùng lặp
      if (error.code === 11000) {
        // Xác định trường bị trùng
        const field = Object.keys(error.keyPattern || {})[0] || "slug";
        if (field === "slug") {
          throw new Error(`Sản phẩm đã bị trùng lặp ở trường ${field}`);
        }
      }

      throw new Error("Lỗi khi lưu sản phẩm: " + error.message);
    }

    return product;
  },

  /**
   * Thêm hình ảnh cho biến thể
   * @param {String} productId - ID sản phẩm
   * @param {String} variantId - ID biến thể
   * @param {Array} files - Các file hình ảnh
   * @returns {Object} - Thông tin biến thể đã cập nhật
   */
  addVariantImages: async (productId, variantId, files) => {
    if (!files || files.length === 0) {
      throw new Error("Vui lòng cung cấp ít nhất một hình ảnh");
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Tìm variant trong sản phẩm
    const variant = product.variants.id(variantId);
    if (!variant) {
      throw new Error("Không tìm thấy biến thể trong sản phẩm");
    }

    // Tải lên nhiều hình ảnh
    const { uploadImage } = require("../utils/cloudinary");
    const uploadPromises = files.map((file) => uploadImage(file));
    const uploadedImages = await Promise.all(uploadPromises);

    // Khởi tạo mảng hình ảnh nếu chưa có
    if (!variant.imagesvariant) {
      variant.imagesvariant = [];
    }

    // Thêm URLs hình ảnh đã tải lên vào mảng hình ảnh của biến thể
    const newImages = uploadedImages.map((url) => ({
      url,
      public_id: url.split("/").pop().split(".")[0],
      isMain: false,
      displayOrder: variant.imagesvariant.length,
    }));

    variant.imagesvariant.push(...newImages);

    // Lưu sản phẩm đã cập nhật
    await product.save();

    return variant;
  },

  /**
   * Xóa hình ảnh biến thể
   * @param {String} productId - ID sản phẩm
   * @param {String} variantId - ID biến thể
   * @param {String} imageUrl - URL hình ảnh cần xóa
   * @returns {Object} - Thông tin biến thể đã cập nhật
   */
  deleteVariantImage: async (productId, variantId, imageUrl) => {
    if (!imageUrl) {
      throw new Error("Vui lòng cung cấp URL hình ảnh cần xóa");
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Tìm variant
    const variant = product.variants.id(variantId);
    if (!variant || !variant.imagesvariant) {
      throw new Error("Không tìm thấy biến thể hoặc ảnh");
    }

    // Tìm và xóa ảnh
    const imageIndex = variant.imagesvariant.findIndex(
      (img) => img.url === imageUrl
    );
    if (imageIndex === -1) {
      throw new Error("Không tìm thấy hình ảnh");
    }

    // Xóa từ Cloudinary
    const { deleteImage } = require("../utils/cloudinary");
    await deleteImage(variant.imagesvariant[imageIndex].public_id);

    // Xóa khỏi mảng
    variant.imagesvariant.splice(imageIndex, 1);

    // Lưu sản phẩm
    await product.save();

    return variant;
  },

  /**
   * Sắp xếp lại thứ tự hình ảnh
   * @param {String} productId - ID sản phẩm
   * @param {String} colorId - ID màu sắc
   * @param {Array} imageOrder - Thứ tự hình ảnh mới
   * @returns {Object} - Thông tin màu sắc đã cập nhật
   */
  reorderProductImages: async (productId, colorId, imageOrder) => {
    if (!colorId || !imageOrder || !Array.isArray(imageOrder)) {
      throw new Error("Vui lòng cung cấp đầy đủ thông tin");
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Tìm màu sắc trong sản phẩm
    const colorIndex = product.colors.findIndex(
      (c) => c.color.toString() === colorId
    );

    if (colorIndex === -1) {
      throw new Error("Không tìm thấy màu sắc trong sản phẩm");
    }

    // Kiểm tra xem mảng thứ tự có chứa đúng số lượng hình ảnh không
    if (imageOrder.length !== product.colors[colorIndex].images.length) {
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

    return product.colors[colorIndex];
  },

  /**
   * Quản lý biến thể sản phẩm
   * @param {String} productId - ID sản phẩm
   * @param {String} variantId - ID biến thể (nếu có)
   * @param {String} action - Hành động (create, update, delete)
   * @param {Object} data - Dữ liệu biến thể
   * @returns {Object} - Kết quả sau khi quản lý biến thể
   */
  manageVariant: async (productId, variantId, action, data) => {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Kiểm tra giới tính
    if (data && data.gender && !["male", "female"].includes(data.gender)) {
      throw new Error("Giới tính của biến thể phải là 'male' hoặc 'female'");
    }

    let result;
    switch (action) {
      case "create":
        // Kiểm tra xem biến thể đã tồn tại chưa
        const existingVariant = product.variants.find(
          (v) =>
            v.color.toString() === data.color.toString() &&
            v.gender === data.gender &&
            v.sizes.some((s) => s.size.toString() === data.size.toString())
        );

        if (existingVariant) {
          throw new Error("Biến thể này đã tồn tại");
        }

        // Kiểm tra xem đã có variant với color và gender này chưa
        const existingColorGender = product.variants.find(
          (v) =>
            v.color.toString() === data.color.toString() &&
            v.gender === data.gender
        );

        if (existingColorGender) {
          // Thêm size mới vào variant đã tồn tại
          existingColorGender.sizes.push({
            size: data.size,
            quantity: data.quantity || 0,
            totalSoldSize: 0,
            isSizeAvailable: true,
          });
          result = existingColorGender;
        } else {
          // Tạo variant mới
          const newVariant = {
            color: data.color,
            gender: data.gender,
            sizes: [
              {
                size: data.size,
                quantity: data.quantity || 0,
                totalSoldSize: 0,
                isSizeAvailable: true,
              },
            ],
            price: data.price || product.price,
            costPrice: data.costPrice || product.costPrice,
            percentDiscount: data.percentDiscount || 0,
            status: data.status || "active",
            sku: sku,
            imagesvariant: data.images || [],
          };

          product.variants.push(newVariant);
          result = product.variants[product.variants.length - 1];
        }
        break;

      case "update":
        // Cập nhật biến thể
        const variantToUpdate = product.variants.id(variantId);
        if (!variantToUpdate) {
          throw new Error("Không tìm thấy biến thể");
        }

        // Cập nhật các trường của variant
        if (data.price) variantToUpdate.price = data.price;
        if (data.costPrice) variantToUpdate.costPrice = data.costPrice;
        if (data.percentDiscount)
          variantToUpdate.percentDiscount = data.percentDiscount;
        if (data.status) variantToUpdate.status = data.status;
        if (data.sku) variantToUpdate.sku = data.sku;

        // Cập nhật kích thước nếu được cung cấp
        if (data.size && data.sizeData) {
          const sizeIndex = variantToUpdate.sizes.findIndex(
            (s) => s.size.toString() === data.size.toString()
          );

          if (sizeIndex !== -1) {
            if (data.sizeData.quantity !== undefined)
              variantToUpdate.sizes[sizeIndex].quantity =
                data.sizeData.quantity;
            if (data.sizeData.isSizeAvailable !== undefined)
              variantToUpdate.sizes[sizeIndex].isSizeAvailable =
                data.sizeData.isSizeAvailable;
          }
        }

        result = variantToUpdate;
        break;

      case "delete":
        // Xóa biến thể hoặc kích thước
        const variantToDelete = product.variants.id(variantId);
        if (!variantToDelete) {
          throw new Error("Không tìm thấy biến thể");
        }

        // Nếu có thông tin kích thước, chỉ xóa kích thước đó
        if (data && data.size) {
          const sizeIndex = variantToDelete.sizes.findIndex(
            (s) => s.size.toString() === data.size.toString()
          );

          if (sizeIndex !== -1) {
            variantToDelete.sizes.splice(sizeIndex, 1);
            // Nếu không còn sizes nào, xóa cả variant
            if (variantToDelete.sizes.length === 0) {
              product.variants.pull(variantId);
            }
          }
        } else {
          // Xóa toàn bộ variant
          product.variants.pull(variantId);
        }

        result = { message: "Đã xóa thành công" };
        break;

      default:
        throw new Error("Hành động không hợp lệ");
    }

    // Lưu sản phẩm với các thay đổi
    await product.save();

    // Lấy sản phẩm với thông tin đã cập nhật và đầy đủ
    const updatedProduct = await Product.findById(productId)
      .populate("variants.color", "name hexCode")
      .populate("variants.sizes.size", "value description");

    return {
      result,
      product: updatedProduct,
    };
  },

  /**
   * Xóa hình ảnh sản phẩm
   * @param {String} productId - ID sản phẩm
   * @param {String} imageUrl - URL hình ảnh cần xóa
   * @returns {Array} - Danh sách hình ảnh sau khi xóa
   */
  deleteProductImage: async (productId, imageUrl) => {
    if (!imageUrl) {
      throw new Error("Vui lòng cung cấp URL hình ảnh cần xóa");
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Tìm vị trí hình ảnh trong mảng
    const imageIndex = product.images.findIndex((img) => img.url === imageUrl);
    if (imageIndex === -1) {
      throw new Error("Không tìm thấy hình ảnh");
    }

    // Xóa hình ảnh từ Cloudinary
    const { deleteImage } = require("../utils/cloudinary");
    await deleteImage(product.images[imageIndex].public_id);

    // Xóa URL hình ảnh khỏi mảng
    product.images.splice(imageIndex, 1);

    // Lưu sản phẩm đã cập nhật
    await product.save();

    return product.images;
  },

  /**
   * Lấy danh sách sản phẩm với phân trang và lọc
   * @param {Object} reqQuery - Các tham số truy vấn từ request
   * @returns {Object} - Kết quả phân trang với danh sách sản phẩm
   */
  getAllProducts: async (reqQuery) => {
    // Mặc định chỉ hiển thị sản phẩm hoạt động cho người dùng
    const isAdmin = reqQuery.isAdmin || false;

    // Tạo các tùy chọn tìm kiếm và lọc
    const searchOptions = {
      searchableFields: ["name", "description", "sku"],
      filterableFields: [
        "category",
        "brand",
        "gender",
        "stockStatus",
        "isActive",
        "isDeleted",
        "price",
      ],
      numericFields: ["price", "rating"],
      booleanFields: ["isActive", "isDeleted", "isFeatured"],
    };

    // Tạo query cơ bản dựa trên quyền
    let baseQuery = {};
    if (!isAdmin) {
      baseQuery.isActive = true;
      baseQuery.isDeleted = false;
    }

    // Áp dụng các bộ lọc từ request
    const filterQuery = paginationService.applyFilters(reqQuery, searchOptions);
    const query = { ...baseQuery, ...filterQuery };

    // Tạo thông tin phân trang và sắp xếp
    const { pagination, sort } = paginationService.createPaginationQuery(
      reqQuery,
      {
        defaultSortField: "createdAt",
        defaultSortOrder: "desc",
      }
    );

    // Thực hiện truy vấn với phân trang
    const products = await Product.find(query)
      .populate([
        { path: "category", select: "name" },
        { path: "brand", select: "name" },
        ...(isAdmin
          ? [
              { path: "colors.color", select: "name hexCode" },
              { path: "variants.color", select: "name hexCode" },
              { path: "variants.size", select: "value" },
            ]
          : []),
      ])
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Đếm tổng số bản ghi
    const total = await Product.countDocuments(query);

    // Format dữ liệu sản phẩm
    const formattedProducts = productService.formatProductsForResponse(
      products,
      isAdmin
    );

    // Tạo response phân trang
    return paginationService.createPaginationResponse(
      formattedProducts,
      total,
      pagination
    );
  },

  /**
   * Định dạng danh sách sản phẩm cho response
   * @param {Array} products - Danh sách sản phẩm từ database
   * @param {Boolean} isAdmin - Có phải admin không
   * @returns {Array} - Danh sách sản phẩm đã được định dạng
   */
  formatProductsForResponse: (products, isAdmin = false) => {
    return products.map((product) => {
      // Tạo đối tượng cơ bản cho sản phẩm
      const formattedProduct = {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        discountPrice: product.discountPrice,
        thumbnail: product.thumbnail,
        rating: product.rating,
        numReviews: product.numReviews,
        stockStatus: product.stockStatus || product.calculatedStockStatus,
        brand: product.brand,
        category: product.category,
        isFeatured: product.isFeatured,
        isNew: product.isNew,
        gender: product.gender,
      };

      // Thêm thông tin chi tiết cho admin
      if (isAdmin) {
        formattedProduct.costPrice = product.costPrice;
        formattedProduct.totalQuantity = product.calculatedTotalQuantity;
        formattedProduct.isActive = product.isActive;
        formattedProduct.isDeleted = product.isDeleted;
        formattedProduct.colors = product.colors;
        formattedProduct.variants = product.variants;
        formattedProduct.createdAt = product.createdAt;
        formattedProduct.updatedAt = product.updatedAt;
      }

      return formattedProduct;
    });
  },

  /**
   * Lấy danh sách sản phẩm nổi bật
   * @param {Object} reqQuery - Các tham số truy vấn từ request
   * @returns {Object} - Kết quả phân trang với danh sách sản phẩm nổi bật
   */
  getFeaturedProducts: async (reqQuery) => {
    // Tạo query cơ bản cho sản phẩm nổi bật (đang hoạt động và được đánh dấu là nổi bật)
    const baseQuery = {
      isFeatured: true,
      isActive: true,
      isDeleted: false,
    };

    // Tạo các tùy chọn tìm kiếm và lọc
    const searchOptions = {
      filterableFields: ["category", "brand", "gender"],
      numericFields: ["price", "rating"],
    };

    // Áp dụng các bộ lọc từ request
    const filterQuery = paginationService.applyFilters(reqQuery, searchOptions);
    const query = { ...baseQuery, ...filterQuery };

    // Tạo thông tin phân trang và sắp xếp
    const { pagination, sort } = paginationService.createPaginationQuery(
      reqQuery,
      {
        defaultSortField: "createdAt",
        defaultSortOrder: "desc",
      }
    );

    // Thực hiện truy vấn với phân trang
    const products = await Product.find(query)
      .populate([
        { path: "category", select: "name" },
        { path: "brand", select: "name" },
      ])
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Đếm tổng số bản ghi
    const total = await Product.countDocuments(query);

    // Format dữ liệu sản phẩm
    const formattedProducts = productService.formatProductsForResponse(
      products,
      false
    );

    // Tạo response phân trang
    return paginationService.createPaginationResponse(
      formattedProducts,
      total,
      pagination
    );
  },

  /**
   * Tìm kiếm và lọc sản phẩm kết hợp
   * @param {Object} reqQuery - Các tham số truy vấn từ request
   * @returns {Object} - Kết quả phân trang với danh sách sản phẩm
   */
  searchAndFilter: async (reqQuery) => {
    // Mặc định chỉ hiển thị sản phẩm hoạt động cho người dùng
    const isAdmin = reqQuery.isAdmin || false;

    // Tạo các tùy chọn tìm kiếm và lọc
    const searchOptions = {
      searchableFields: ["name", "description", "sku"],
      filterableFields: [
        "category",
        "brand",
        "gender",
        "stockStatus",
        "isActive",
        "isDeleted",
        "price",
        "isFeatured",
        "isNew",
        "rating",
      ],
      numericFields: ["price", "rating"],
      booleanFields: ["isActive", "isDeleted", "isFeatured", "isNew"],
    };

    // Tạo query cơ bản dựa trên quyền
    let baseQuery = {};
    if (!isAdmin) {
      baseQuery.isActive = true;
      baseQuery.isDeleted = false;
    }

    // Áp dụng các bộ lọc từ request
    const filterQuery = paginationService.applyFilters(reqQuery, searchOptions);

    // Xử lý khoảng giá nếu có
    if (reqQuery.minPrice || reqQuery.maxPrice) {
      const priceFilter = {};
      if (reqQuery.minPrice) {
        priceFilter.$gte = parseFloat(reqQuery.minPrice);
      }
      if (reqQuery.maxPrice) {
        priceFilter.$lte = parseFloat(reqQuery.maxPrice);
      }
      if (Object.keys(priceFilter).length > 0) {
        filterQuery.price = priceFilter;
      }
    }

    // Xử lý khoảng đánh giá nếu có
    if (reqQuery.minRating) {
      filterQuery.rating = { $gte: parseFloat(reqQuery.minRating) };
    }

    // Kết hợp các điều kiện
    const query = { ...baseQuery, ...filterQuery };

    // Tạo thông tin phân trang và sắp xếp
    const { pagination, sort } = paginationService.createPaginationQuery(
      reqQuery,
      {
        defaultSortField: "createdAt",
        defaultSortOrder: "desc",
      }
    );

    // Thực hiện truy vấn với phân trang
    const products = await Product.find(query)
      .populate([
        { path: "category", select: "name" },
        { path: "brand", select: "name" },
        ...(isAdmin
          ? [
              { path: "colors.color", select: "name hexCode" },
              { path: "variants.color", select: "name hexCode" },
              { path: "variants.size", select: "value" },
            ]
          : []),
      ])
      .sort(sort)
      .skip(pagination.skip)
      .limit(pagination.limit);

    // Đếm tổng số bản ghi
    const total = await Product.countDocuments(query);

    // Format dữ liệu sản phẩm
    const formattedProducts = productService.formatProductsForResponse(
      products,
      isAdmin
    );

    // Tạo response phân trang
    return paginationService.createPaginationResponse(
      formattedProducts,
      total,
      pagination
    );
  },

  /**
   * Lấy chi tiết sản phẩm
   * @param {String} id - ID sản phẩm
   * @param {Boolean} isAdmin - Có phải admin không
   * @returns {Object} - Thông tin chi tiết sản phẩm
   */
  getProductDetails: async (id, isAdmin) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const query = { _id: id };
    if (!isAdmin) {
      query.isActive = true;
      query.isDeleted = false;
    }

    const product = await Product.findOne(query)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("variants.color", "name hexCode")
      .populate("variants.sizes.size", "value description");

    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    return product;
  },

  /**
   * Cập nhật thông tin sản phẩm
   * @param {String} id - ID sản phẩm
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Object} - Sản phẩm đã được cập nhật
   */
  updateProduct: async (id, updateData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const { name, description, price } = updateData;

    // Validation
    if (name && name.trim().length === 0) {
      throw new Error("Tên sản phẩm không được để trống");
    }

    if (description && description.trim().length === 0) {
      throw new Error("Mô tả sản phẩm không được để trống");
    }

    if (price !== undefined && price <= 0) {
      throw new Error("Giá sản phẩm phải lớn hơn 0");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    Object.assign(product, updateData);
    await product.save();

    return product;
  },

  /**
   * Xóa sản phẩm
   * @param {String} id - ID sản phẩm
   * @returns {Object} - Kết quả xóa sản phẩm
   */
  deleteProduct: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    await product.remove();
    return { message: "Sản phẩm đã được xóa thành công" };
  },

  /**
   * Quản lý kho hàng
   * @param {String} id - ID sản phẩm
   * @param {Object} stockData - Dữ liệu kho hàng
   * @returns {Object} - Kết quả cập nhật kho hàng
   */
  manageProductStock: async (id, stockData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const { action, quantity } = stockData;

    if (!action || !["add", "subtract", "set"].includes(action)) {
      throw new Error("Hành động không hợp lệ");
    }

    if (quantity === undefined || quantity < 0) {
      throw new Error("Số lượng phải là số dương");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    switch (action) {
      case "add":
        product.stock += quantity;
        break;
      case "subtract":
        product.stock = Math.max(0, product.stock - quantity);
        break;
      case "set":
        product.stock = quantity;
        break;
    }

    await product.save();
    return product;
  },

  /**
   * Lấy sản phẩm liên quan
   * @param {String} id - ID sản phẩm
   * @param {Object} options - Các tùy chọn
   * @param {Boolean} isAdmin - Có phải admin không
   * @returns {Array} - Danh sách sản phẩm liên quan
   */
  getRelatedProducts: async (id, options, isAdmin) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    const query = {
      _id: { $ne: id },
      category: product.category,
      brand: product.brand,
    };

    if (!isAdmin) {
      query.isActive = true;
      query.isDeleted = false;
    }

    const relatedProducts = await Product.find(query)
      .populate("category", "name")
      .populate("brand", "name")
      .limit(options.limit || 5);

    return relatedProducts;
  },

  /**
   * Kiểm tra tình trạng sản phẩm
   * @param {String} id - ID sản phẩm
   * @returns {Object} - Thông tin tình trạng sản phẩm
   */
  checkProductAvailability: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    return {
      available: product.stock > 0,
      stock: product.stock,
    };
  },

  /**
   * Thống kê hàng tồn kho
   * @param {String} id - ID sản phẩm
   * @returns {Object} - Thông tin thống kê
   */
  getInventoryStats: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    return {
      totalStock: product.stock,
      variants: product.variants,
    };
  },

  /**
   * Gợi ý tìm kiếm
   * @param {String} keyword - Từ khóa tìm kiếm
   * @param {Object} options - Các tùy chọn
   * @returns {Array} - Danh sách gợi ý
   */
  getSearchSuggestions: async (keyword, options) => {
    if (!keyword || keyword.trim().length === 0) {
      throw new Error("Từ khóa tìm kiếm không được để trống");
    }

    const suggestions = await Product.find({
      name: { $regex: keyword, $options: "i" },
    })
      .limit(options.limit || 5)
      .select("name")
      .exec();

    return suggestions;
  },

  // Lấy danh sách sản phẩm với phân trang và lọc
  async getProducts(queryOptions) {
    const {
      page = 1,
      limit = 10,
      category,
      brand,
      minPrice,
      maxPrice,
      sort,
      search,
    } = queryOptions;

    // Xây dựng query cho filter
    let query = { isDeleted: false };
    if (category) query.category = category;
    if (brand) query.brand = brand;

    // Filter theo giá
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Xử lý search
    if (search) {
      query.$text = { $search: search };
    }

    // Xử lý sort
    let sortOption = {};
    if (sort) {
      const [field, order] = sort.split(":");
      sortOption[field] = order === "desc" ? -1 : 1;
    } else {
      sortOption = { createdAt: -1 }; // Mặc định sắp xếp theo thời gian tạo
    }

    // Thực hiện query với pagination
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sort: sortOption,
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name" },
      ],
    };

    return await Product.paginate(query, options);
  },

  // Thêm sản phẩm mới
  async createProduct(productData) {
    const product = new Product(productData);
    return await product.save();
  },

  // Lấy thông tin chi tiết sản phẩm
  async getProductById(productId) {
    return await Product.findById(productId)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("variants.color", "name code")
      .populate("variants.sizes.size", "name value");
  },

  // Lấy sản phẩm theo slug
  async getProductBySlug(slug) {
    return await Product.findOne({ slug, isDeleted: false })
      .populate("category", "name")
      .populate("brand", "name")
      .populate("variants.color", "name code")
      .populate("variants.sizes.size", "name value");
  },

  // Cập nhật sản phẩm
  async updateProduct(productId, updateData) {
    return await Product.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    });
  },

  // Xóa sản phẩm (soft delete)
  async deleteProduct(productId) {
    return await Product.findByIdAndUpdate(
      productId,
      { isDeleted: true, isActive: false },
      { new: true }
    );
  },

  // Cập nhật số lượng sản phẩm
  async updateProductStock(productId, variantId, sizeId, quantity) {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm");

    const variant = product.variants.id(variantId);
    if (!variant) throw new Error("Không tìm thấy biến thể sản phẩm");

    const sizeItem = variant.sizes.find((s) => s.size.toString() === sizeId);
    if (!sizeItem) throw new Error("Không tìm thấy size");

    sizeItem.quantity = Math.max(0, sizeItem.quantity + quantity);

    return await product.save();
  },

  // Tăng số lượng đã bán
  async incrementSoldCount(productId, variantId, sizeId, quantity) {
    const product = await Product.findById(productId);
    if (!product) throw new Error("Không tìm thấy sản phẩm");

    const variant = product.variants.id(variantId);
    if (!variant) throw new Error("Không tìm thấy biến thể sản phẩm");

    const sizeItem = variant.sizes.find((s) => s.size.toString() === sizeId);
    if (!sizeItem) throw new Error("Không tìm thấy size");

    sizeItem.totalSoldSize += quantity;
    sizeItem.quantity = Math.max(0, sizeItem.quantity - quantity);

    return await product.save();
  },
};

module.exports = productService;
