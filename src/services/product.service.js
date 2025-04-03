const { Product, Variant, Category, Brand, Size, Color } = require("@models");
const mongoose = require("mongoose");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
const { updateProductStockInfo } = require("@models/product/middlewares");

const productService = {
  // === ADMIN API METHODS ===

  /**
   * [ADMIN] Lấy danh sách sản phẩm (có phân trang, filter)
   * @param {Object} query Tham số truy vấn
   */
  getAdminProducts: async (query) => {
    const {
      page = 1,
      limit = 10,
      name,
      category,
      brand,
      stockStatus,
      isActive,
      sort,
    } = query;

    const filter = { deletedAt: null }; // Mặc định chỉ lấy chưa xóa

    // Lọc theo tên
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Lọc theo danh mục
    if (category) {
      filter.category = mongoose.Types.ObjectId.isValid(category)
        ? new mongoose.Types.ObjectId(String(category))
        : null;
    }

    // Lọc theo thương hiệu
    if (brand) {
      filter.brand = mongoose.Types.ObjectId.isValid(brand)
        ? new mongoose.Types.ObjectId(String(brand))
        : null;
    }

    // Lọc theo trạng thái tồn kho
    if (stockStatus) {
      filter.stockStatus = stockStatus;
    }

    // Lọc theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive === "true" || isActive === true;
    }

    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name logo" },
      ],
    };

    return await paginate(Product, filter, options);
  },

  /**
   * [ADMIN] Lấy chi tiết sản phẩm theo ID (kèm variants)
   * @param {String} id ID của sản phẩm
   */
  getAdminProductById: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id)
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate({
        path: "variants",
        select: "-deletedAt -deletedBy",
        populate: [
          { path: "color", select: "name type code colors" },
          { path: "sizes.size", select: "value description" },
        ],
      })
      .setOptions({ includeDeleted: true });

    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    return {
      success: true,
      product,
    };
  },

  /**
   * [ADMIN] Lấy danh sách sản phẩm đã xóa
   * @param {Object} query Tham số truy vấn
   */
  getDeletedProducts: async (query) => {
    const { page = 1, limit = 10, name, category, brand, sort } = query;

    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    if (category) {
      filter.category = mongoose.Types.ObjectId.isValid(category)
        ? new mongoose.Types.ObjectId(String(category))
        : null;
    }

    if (brand) {
      filter.brand = mongoose.Types.ObjectId.isValid(brand)
        ? new mongoose.Types.ObjectId(String(brand))
        : null;
    }

    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { deletedAt: -1 },
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name" },
        { path: "deletedBy", select: "firstName lastName email" },
      ],
    };

    return await paginateDeleted(Product, filter, options);
  },

  /**
   * Tạo sản phẩm mới
   * @param {Object} productData Thông tin sản phẩm
   */
  createProduct: async (productData) => {
    // Kiểm tra category và brand tồn tại
    const categoryExists = await Category.findById(productData.category);
    if (!categoryExists) {
      throw new Error("Danh mục không tồn tại");
    }

    const brandExists = await Brand.findById(productData.brand);
    if (!brandExists) {
      throw new Error("Thương hiệu không tồn tại");
    }

    // Kiểm tra sản phẩm đã tồn tại (trùng hết tất cả các thông tin)
    const duplicate = await Product.findOne({
      name: productData.name,
      description: productData.description,
      category: productData.category,
      brand: productData.brand,
    });
    if (duplicate) {
      throw new Error("Sản phẩm đã tồn tại với thông tin này");
    }

    // Tạo sản phẩm mới
    const product = new Product({
      name: productData.name,
      description: productData.description,
      category: productData.category,
      brand: productData.brand,
      isActive:
        productData.isActive !== undefined ? productData.isActive : true,
      // Không khởi tạo images ở đây vì sẽ được xử lý qua imageService
    });

    // Lưu sản phẩm - các middleware sẽ tự động tạo slug
    await product.save();

    return {
      success: true,
      message: "Tạo sản phẩm thành công",
      product,
    };
  },

  /**
   * Cập nhật thông tin sản phẩm
   * @param {String} id ID sản phẩm
   * @param {Object} updateData Dữ liệu cập nhật
   */
  updateProduct: async (id, updateData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Kiểm tra nếu cập nhật category
    if (updateData.category) {
      const categoryExists = await Category.findById(updateData.category);
      if (!categoryExists) {
        throw new Error("Danh mục không tồn tại");
      }
    }

    // Kiểm tra nếu cập nhật brand
    if (updateData.brand) {
      const brandExists = await Brand.findById(updateData.brand);
      if (!brandExists) {
        throw new Error("Thương hiệu không tồn tại");
      }
    }

    // Cập nhật các trường
    const allowedFields = [
      "name",
      "description",
      "category",
      "brand",
      "isActive",
    ];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        product[key] = value;
      }
    }

    // Lưu sản phẩm - các middleware sẽ cập nhật slug nếu tên thay đổi
    await product.save();

    return {
      success: true,
      message: "Cập nhật sản phẩm thành công",
      product,
    };
  },

  /**
   * Xóa mềm sản phẩm
   * @param {String} id ID sản phẩm
   * @param {String} userId ID người xóa
   */
  deleteProduct: async (id, userId) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Soft delete sản phẩm sử dụng plugin softDelete
    await product.softDelete(userId);

    // Tắt trạng thái active của các variant liên quan
    await Variant.updateMany(
      { _id: { $in: product.variants } },
      { $set: { isActive: false } }
    );

    return {
      success: true,
      message: "Xóa sản phẩm thành công",
    };
  },

  /**
   * Khôi phục sản phẩm đã xóa
   * @param {String} id ID sản phẩm
   */
  restoreProduct: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    // Khôi phục sản phẩm - middleware sẽ kiểm tra slug trùng lặp và tạo slug mới nếu cần
    const product = await Product.restoreById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm để khôi phục");
    }

    return {
      success: true,
      message: "Khôi phục sản phẩm thành công",
      product,
    };
  },

  /**
   * Cập nhật trạng thái active của sản phẩm
   * @param {String} id ID sản phẩm
   * @param {Boolean} isActive Trạng thái active
   * @param {Boolean} cascade Cập nhật cả variants
   */
  updateProductStatus: async (id, isActive, cascade = true) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Cập nhật trạng thái product
    product.isActive = isActive;
    await product.save();

    let affectedVariants = 0;

    // CASCADE: Chỉ cập nhật variants khi cascade = true
    if (cascade && product.variants.length > 0) {
      const result = await Variant.updateMany(
        { _id: { $in: product.variants } },
        { $set: { isActive: isActive } }
      );
      affectedVariants = result.modifiedCount;
    }

    const statusMsg = isActive ? "kích hoạt" : "vô hiệu hóa";
    return {
      success: true,
      message: cascade
        ? `Sản phẩm đã được ${statusMsg}. Đã ${statusMsg} ${affectedVariants} biến thể liên quan.`
        : `Sản phẩm đã được ${statusMsg} mà không ảnh hưởng đến biến thể.`,
      product,
    };
  },

  /**
   * Cập nhật thủ công trạng thái tồn kho của sản phẩm
   * @param {String} id ID sản phẩm
   */
  updateProductStockStatus: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id).populate({
      path: "variants",
      select: "sizes",
      match: { deletedAt: null, isActive: true },
    });

    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    // Cập nhật thông tin tồn kho sử dụng hàm từ middleware
    await updateProductStockInfo(product);

    // Lấy sản phẩm đã cập nhật
    const updatedProduct = await Product.findById(id);

    return {
      success: true,
      message: "Cập nhật trạng thái tồn kho thành công",
      product: updatedProduct,
    };
  },

  // Các phương thức xử lý ảnh đã được di chuyển qua image.service.js,

  // === PUBLIC API METHODS ===

  /**
   * [PUBLIC] Lấy danh sách sản phẩm với lọc phức tạp (màu, size, giá...)
   * @param {Object} query Tham số truy vấn
   */
  getPublicProducts: async (query) => {
    const {
      page = 1,
      limit = 12,
      name,
      category,
      brand,
      minPrice,
      maxPrice,
      colors,
      sizes,
      gender,
      sort = "newest",
    } = query;

    // Chỉ lấy sản phẩm active và chưa xóa
    const filter = {
      isActive: true,
      deletedAt: null,
    };

    // Tìm theo tên
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Tìm theo danh mục
    if (category) {
      filter.category = mongoose.Types.ObjectId.isValid(category)
        ? new mongoose.Types.ObjectId(String(category))
        : null;
    }

    // Tìm theo thương hiệu
    if (brand) {
      filter.brand = mongoose.Types.ObjectId.isValid(brand)
        ? new mongoose.Types.ObjectId(String(brand))
        : null;
    }

    // Thêm bộ lọc nâng cao (màu, size, giá, giới tính)
    const advancedFilter = {};

    // Nếu có lọc theo màu
    if (colors) {
      const colorIds = colors.split(",");
      const validColorIds = colorIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (validColorIds.length > 0) {
        advancedFilter["color"] = {
          $in: validColorIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }
    }

    // Nếu có lọc theo kích thước
    if (sizes) {
      const sizeIds = sizes.split(",");
      const validSizeIds = sizeIds.filter((id) =>
        mongoose.Types.ObjectId.isValid(id)
      );

      if (validSizeIds.length > 0) {
        advancedFilter["sizes.size"] = {
          $in: validSizeIds.map((id) => new mongoose.Types.ObjectId(id)),
        };
      }
    }

    // Nếu có lọc theo giới tính
    if (gender && ["male", "female"].includes(gender)) {
      advancedFilter["gender"] = gender;
    }

    // Nếu có lọc theo khoảng giá
    if (minPrice !== undefined || maxPrice !== undefined) {
      advancedFilter["priceFinal"] = {};

      if (minPrice !== undefined) {
        advancedFilter["priceFinal"].$gte = Number(minPrice);
      }

      if (maxPrice !== undefined) {
        advancedFilter["priceFinal"].$lte = Number(maxPrice);
      }
    }

    // Sắp xếp
    let sortOption = { createdAt: -1 }; // Mặc định theo mới nhất

    switch (sort) {
      case "price-asc":
        sortOption = { priceFinal: 1 };
        break;
      case "price-desc":
        sortOption = { priceFinal: -1 };
        break;
      case "popular":
        sortOption = { totalQuantity: -1 };
        break;
      case "rating":
        sortOption = { rating: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const options = {
      page,
      limit,
      sort: sortOption,
      populate: [
        { path: "category", select: "name" },
        { path: "brand", select: "name logo" },
      ],
    };

    // Nếu có filter nâng cao, sử dụng lookup aggregation
    if (Object.keys(advancedFilter).length > 0) {
      // Tìm ID của các sản phẩm có variant phù hợp
      const variantMatchingProducts = await Variant.find({
        ...advancedFilter,
        isActive: true,
        deletedAt: null,
      }).distinct("product");

      // Thêm điều kiện vào filter
      if (variantMatchingProducts.length > 0) {
        filter._id = { $in: variantMatchingProducts };
      } else {
        // Nếu không có variant nào phù hợp, trả về kết quả rỗng
        return {
          success: true,
          count: 0,
          total: 0,
          totalPages: 0,
          currentPage: page,
          hasNextPage: false,
          hasPrevPage: false,
          data: [],
        };
      }
    }

    return await paginate(Product, filter, options);
  },

  /**
   * [PUBLIC] Lấy chi tiết sản phẩm theo ID
   * @param {String} id ID của sản phẩm
   */
  getPublicProductById: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findOne({
      _id: id,
      isActive: true,
      deletedAt: null,
    })
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate({
        path: "variants",
        match: { isActive: true, deletedAt: null },
        populate: [
          { path: "color", select: "name type code colors" },
          { path: "sizes.size", select: "value description" },
        ],
      });

    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    return {
      success: true,
      product,
    };
  },

  /**
   * [PUBLIC] Lấy chi tiết sản phẩm theo slug
   * @param {String} slug Slug của sản phẩm
   */
  getPublicProductBySlug: async (slug) => {
    const product = await Product.findOne({
      slug,
      isActive: true,
      deletedAt: null,
    })
      .populate("category", "name")
      .populate("brand", "name logo")
      .populate({
        path: "variants",
        match: { isActive: true, deletedAt: null },
        populate: [
          { path: "color", select: "name type code colors" },
          { path: "sizes.size", select: "value description" },
        ],
      });

    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    return {
      success: true,
      product,
    };
  },

  /**
   * [PUBLIC] Lấy sản phẩm nổi bật (theo rating cao)
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getFeaturedProducts: async (limit = 8) => {
    const products = await Product.find({
      isActive: true,
      deletedAt: null,
      rating: { $gte: 4 },
    })
      .sort({ rating: -1, numReviews: -1 })
      .limit(Number(limit))
      .populate("category", "name")
      .populate("brand", "name logo");

    return {
      success: true,
      products,
    };
  },

  /**
   * [PUBLIC] Lấy sản phẩm mới nhất
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getNewArrivals: async (limit = 8) => {
    const products = await Product.find({
      isActive: true,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("category", "name")
      .populate("brand", "name logo");

    return {
      success: true,
      products,
    };
  },

  /**
   * [PUBLIC] Lấy sản phẩm bán chạy (dựa trên tổng số lượng đã bán)
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getBestSellers: async (limit = 8) => {
    // Giả sử có một trường totalSold trong model Product
    const products = await Product.find({
      isActive: true,
      deletedAt: null,
    })
      .sort({ totalQuantity: -1 }) // Tạm thời dùng totalQuantity, sau này có thể thay bằng totalSold
      .limit(Number(limit))
      .populate("category", "name")
      .populate("brand", "name logo");

    return {
      success: true,
      products,
    };
  },

  /**
   * [PUBLIC] Lấy sản phẩm liên quan (cùng danh mục)
   * @param {String} id ID sản phẩm
   * @param {Number} limit Số lượng sản phẩm trả về
   */
  getRelatedProducts: async (id, limit = 4) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID sản phẩm không hợp lệ");
    }

    const product = await Product.findById(id);
    if (!product) {
      throw new Error("Không tìm thấy sản phẩm");
    }

    const relatedProducts = await Product.find({
      category: product.category,
      _id: { $ne: id },
      isActive: true,
      deletedAt: null,
    })
      .sort({ rating: -1 })
      .limit(Number(limit))
      .populate("category", "name")
      .populate("brand", "name logo");

    return {
      success: true,
      products: relatedProducts,
    };
  },

  /**
   * [PUBLIC] Lấy thuộc tính lọc cho sản phẩm
   */
  getFilterAttributes: async () => {
    const categories = await Category.find({ isActive: true }).select("name");
    const brands = await Brand.find({ isActive: true }).select("name logo");
    const colors = await Color.find({ isActive: true }).select(
      "name code type"
    );
    const sizes = await Size.find({ isActive: true }).select(
      "value description"
    );

    // Tính khoảng giá từ variants có sẵn
    const priceRange = await Variant.aggregate([
      { $match: { isActive: true, deletedAt: null } },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$priceFinal" },
          maxPrice: { $max: "$priceFinal" },
        },
      },
    ]);

    const minPrice = priceRange.length > 0 ? priceRange[0].minPrice : 0;
    const maxPrice = priceRange.length > 0 ? priceRange[0].maxPrice : 10000000;

    return {
      success: true,
      filters: {
        categories,
        brands,
        colors,
        sizes,
        priceRange: { min: minPrice, max: maxPrice },
        genders: ["male", "female"],
      },
    };
  },
};

module.exports = productService;
