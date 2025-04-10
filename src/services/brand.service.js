const { Brand, Product, Variant } = require("@models");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");
// Hàm hỗ trợ xử lý các case sắp xếp
const getSortOption = (sortParam) => {
  let sortOption = { createdAt: -1 };
  if (sortParam) {
    switch (sortParam) {
      case "created_at_asc":
        sortOption = { createdAt: 1 };
        break;
      case "created_at_desc":
        sortOption = { createdAt: -1 };
        break;
      case "name_asc":
        sortOption = { name: 1 };
        break;
      case "name_desc":
        sortOption = { name: -1 };
        break;
      default:
        try {
          sortOption = JSON.parse(sortParam);
        } catch (err) {
          sortOption = { createdAt: -1 };
        }
        break;
    }
  }
  return sortOption;
};

const brandService = {
  // === ADMIN API METHODS ===

  /**
   * [ADMIN] Lấy tất cả brand (bao gồm cả inactive)
   */
  getAdminAllBrands: async (query) => {
    const { page = 1, limit = 10, name, isActive, sort } = query;
    const filter = { deletedAt: null }; // Mặc định chỉ lấy các brand chưa xóa

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Sửa điều kiện lọc isActive để xử lý cả chuỗi lẫn boolean
    if (isActive === "true" || isActive === true) {
      filter.isActive = true;
    } else if (isActive === "false" || isActive === false) {
      filter.isActive = false;
    }

    const options = {
      page,
      limit,
      sort: sort ? getSortOption(sort) : { createdAt: -1 },
    };

    return await paginate(Brand, filter, options);
  },

  /**
   * [ADMIN] Lấy brand theo ID (bao gồm cả inactive và đã xóa)
   */
  getAdminBrandById: async (brandId) => {
    // Sử dụng setOptions để bao gồm cả brand đã xóa
    const brand = await Brand.findById(brandId).setOptions({
      includeDeleted: true,
    });

    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404; // Not Found
      throw error;
    }

    return { success: true, brand };
  },

  /**
   * [ADMIN] Lấy danh sách brand đã xóa mềm
   */
  getDeletedBrands: async (query) => {
    const { page = 1, limit = 10, name, sort } = query;
    // Chuẩn bị filter
    const filter = {};

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    const options = {
      page,
      limit,
      sort: sort ? getSortOption(sort) : { deletedAt: -1 },
    };

    return await paginateDeleted(Brand, filter, options);
  },

  // === PUBLIC API METHODS ===

  /**
   * [PUBLIC] Lấy tất cả brand (chỉ active và chưa xóa)
   */
  getPublicAllBrands: async () => {
    return await Brand.find({ isActive: true, deletedAt: null });
  },

  /**
   * [PUBLIC] Lấy brand theo ID (chỉ active và chưa xóa)
   */
  getPublicBrandById: async (brandId) => {
    const brand = await Brand.findOne({
      _id: brandId,
      isActive: true,
      deletedAt: null, // Đảm bảo chỉ lấy brand chưa xóa
    });

    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404; // Not Found
      throw error;
    }

    return { success: true, brand };
  },

  /**
   * [PUBLIC] Lấy brand theo slug (chỉ active và chưa xóa)
   */
  getBrandBySlug: async (slug) => {
    const brand = await Brand.findOne({
      slug,
      isActive: true,
      deletedAt: null, // Đảm bảo chỉ lấy brand chưa xóa
    });

    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404; // Not Found
      throw error;
    }

    return { success: true, brand };
  },

  // === COMMON OPERATIONS ===

  /**
   * Tạo brand mới
   */
  createBrand: async (brandData) => {
    // Đảm bảo isActive mặc định là true nếu không được cung cấp
    if (brandData.isActive === undefined) {
      brandData.isActive = true;
    }

    // Kiểm tra tên thương hiệu tồn tại
    const existingBrand = await Brand.findOne({ name: brandData.name });

    if (existingBrand) {
      const error = new Error("Tên thương hiệu đã tồn tại");
      error.statusCode = 409; // Conflict
      throw error;
    }

    const brand = new Brand(brandData);
    await brand.save();

    return {
      success: true,
      message: "Tạo thương hiệu thành công",
      brand,
    };
  },

  /**
   * Cập nhật brand
   */
  updateBrand: async (brandId, brandData) => {
    const brand = await Brand.findById(brandId);

    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Kiểm tra xem có cập nhật tên không và tên mới có trùng không
    if (brandData.name && brandData.name !== brand.name) {
      const existingBrand = await Brand.findOne({
        name: brandData.name,
        _id: { $ne: brandId },
      });

      if (existingBrand) {
        const error = new Error("Tên thương hiệu đã tồn tại");
        error.statusCode = 409; // Conflict
        throw error;
      }
    }

    // Cập nhật từng trường thay vì Object.assign để xử lý thêm logic nếu cần
    if (brandData.name !== undefined) brand.name = brandData.name;
    if (brandData.description !== undefined)
      brand.description = brandData.description;
    if (brandData.isActive !== undefined) brand.isActive = brandData.isActive;
    if (brandData.logo !== undefined) brand.logo = brandData.logo;

    // Các trường audit được thêm tự động bởi middleware

    await brand.save();

    return {
      success: true,
      message: "Cập nhật thương hiệu thành công",
      brand,
    };
  },

  /**
   * Xóa mềm brand - với kiểm tra và tự động vô hiệu hóa
   */
  deleteBrand: async (brandId, userId) => {
    const brand = await Brand.findById(brandId);

    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404;
      throw error;
    }

    // Kiểm tra xem brand có được sử dụng trong sản phẩm nào không
    const productCount = await Product.countDocuments({ brand: brandId });

    // Nếu có sản phẩm liên kết, tự động vô hiệu hóa thay vì xóa
    if (productCount > 0) {
      // Vô hiệu hóa brand và cập nhật cascade
      await brandService.updateBrandStatus(brandId, false, true);

      return {
        success: true,
        message: `Thương hiệu được sử dụng trong ${productCount} sản phẩm nên đã được vô hiệu hóa thay vì xóa.`,
        isDeactivatedInstead: true,
        affectedProducts: productCount,
      };
    }

    // Nếu không có sản phẩm liên kết, tiến hành xóa mềm
    await brand.softDelete(userId);

    return {
      success: true,
      message: "Xóa thương hiệu thành công",
      isDeleted: true,
    };
  },

  /**
   * Khôi phục brand đã xóa mềm - với hỗ trợ khôi phục cascade
   */
  restoreBrand: async (brandId, cascade = true) => {
    // Sử dụng phương thức tĩnh restoreById từ plugin
    const brand = await Brand.restoreById(brandId);

    if (!brand) {
      const error = new Error(
        "Không tìm thấy thương hiệu hoặc thương hiệu không bị xóa"
      );
      error.statusCode = 404;
      throw error;
    }

    // Kích hoạt trạng thái brand (vì restore chỉ xóa deletedAt mà không đổi isActive)
    brand.isActive = true;
    await brand.save();

    let affectedProducts = 0;
    let affectedVariants = 0;

    // CASCADE RESTORE: Kích hoạt các sản phẩm và biến thể liên quan
    if (cascade) {
      // Cập nhật sản phẩm thuộc brand này
      const productResult = await Product.updateMany(
        { brand: brandId },
        { isActive: true }
      );
      affectedProducts = productResult.modifiedCount;

      // Cập nhật biến thể của sản phẩm thuộc brand này
      const products = await Product.find({ brand: brandId }, { _id: 1 });
      const productIds = products.map((product) => product._id);

      if (productIds.length > 0) {
        const variantResult = await Variant.updateMany(
          { product: { $in: productIds } },
          { isActive: true }
        );
        affectedVariants = variantResult.modifiedCount;
      }
    }

    return {
      success: true,
      message: cascade
        ? `Khôi phục thương hiệu thành công. Đã kích hoạt ${affectedProducts} sản phẩm và ${affectedVariants} biến thể liên quan.`
        : "Khôi phục thương hiệu thành công mà không ảnh hưởng đến sản phẩm liên quan.",
      brand,
      cascade: {
        applied: cascade,
        productsActivated: affectedProducts,
        variantsActivated: affectedVariants,
      },
    };
  },

  /**
   * Cập nhật trạng thái active của brand
   * Thêm logic cascade để ẩn/hiện các sản phẩm và biến thể liên quan
   */
  updateBrandStatus: async (brandId, isActive, cascade = true) => {
    const brand = await Brand.findById(brandId);

    if (!brand) {
      const error = new Error("Không tìm thấy thương hiệu");
      error.statusCode = 404; // Not Found
      throw error;
    }

    // Cập nhật trạng thái brand
    brand.isActive = isActive;
    await brand.save();

    let affectedProducts = 0;
    let affectedVariants = 0;

    // CASCADE: Chỉ cập nhật sản phẩm và biến thể khi cascade = true
    if (cascade) {
      // Cập nhật trạng thái tất cả sản phẩm thuộc brand này
      const updateProductResult = await Product.updateMany(
        { brand: brandId },
        { isActive: isActive }
      );
      affectedProducts = updateProductResult.modifiedCount;

      // CASCADE: Cập nhật trạng thái tất cả biến thể của các sản phẩm thuộc brand này
      const products = await Product.find({ brand: brandId }, { _id: 1 });
      const productIds = products.map((product) => product._id);

      if (productIds.length > 0) {
        const variantResult = await Variant.updateMany(
          { product: { $in: productIds } },
          { isActive: isActive }
        );
        affectedVariants = variantResult.modifiedCount;
      }
    }

    const statusMsg = isActive ? "kích hoạt" : "vô hiệu hóa";
    return {
      success: true,
      message: cascade
        ? `Thương hiệu đã được ${statusMsg}. Đã ${statusMsg} ${affectedProducts} sản phẩm và ${affectedVariants} biến thể liên quan.`
        : `Thương hiệu đã được ${statusMsg} mà không ảnh hưởng đến sản phẩm.`,
      brand,
      cascade: {
        applied: cascade,
        productsAffected: affectedProducts,
        variantsAffected: affectedVariants,
      },
    };
  },

  /**
   * Vô hiệu hóa brand thay vì xóa (dùng cho các brand đã có sản phẩm)
   */
  deactivateBrand: async (brandId, cascade = true) => {
    return await brandService.updateBrandStatus(brandId, false, cascade);
  },
};

module.exports = brandService;
