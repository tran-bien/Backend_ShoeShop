const { Brand, Product, Variant } = require("@models");
const paginate = require("@utils/pagination");
const paginateDeleted = require("@utils/paginationDeleted");

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
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
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
      throw new Error("Không tìm thấy thương hiệu");
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
      sort: sort ? JSON.parse(sort) : { deletedAt: -1 },
    };

    return await paginateDeleted(Brand, filter, options);
  },

  // === PUBLIC API METHODS ===

  /**
   * [PUBLIC] Lấy tất cả brand (chỉ active và chưa xóa)
   */
  getPublicAllBrands: async (query) => {
    const { page = 1, limit = 10, name, sort } = query;
    const filter = {
      isActive: true,
      deletedAt: null, // Đảm bảo chỉ lấy các brand chưa xóa
    };

    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
    };

    return await paginate(Brand, filter, options);
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
      throw new Error("Không tìm thấy thương hiệu");
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
      throw new Error("Không tìm thấy thương hiệu");
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
      throw new Error("Tên thương hiệu đã tồn tại");
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
      throw new Error("Không tìm thấy thương hiệu");
    }

    // Kiểm tra xem có cập nhật tên không và tên mới có trùng không
    if (brandData.name && brandData.name !== brand.name) {
      const existingBrand = await Brand.findOne({
        name: brandData.name,
        _id: { $ne: brandId },
      });

      if (existingBrand) {
        throw new Error("Tên thương hiệu đã tồn tại");
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
   * Xóa mềm brand
   */
  deleteBrand: async (brandId, userId) => {
    const brand = await Brand.findById(brandId);

    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    if (brand.deletedAt) {
      throw new Error("Thương hiệu đã bị xóa trước đó");
    }

    // Sử dụng phương thức softDelete từ plugin
    await brand.softDelete(userId);

    return {
      success: true,
      message: "Xóa thương hiệu thành công",
    };
  },

  /**
   * Khôi phục brand đã xóa mềm
   */
  restoreBrand: async (brandId) => {
    // Sử dụng phương thức tĩnh restoreById từ plugin
    const brand = await Brand.restoreById(brandId);

    return {
      success: true,
      message: "Khôi phục thương hiệu thành công",
      brand,
    };
  },

  /**
   * Cập nhật trạng thái active của brand
   * Thêm logic cascade để ẩn/hiện các sản phẩm và biến thể liên quan
   */
  updateBrandStatus: async (brandId, isActive, cascade = true) => {
    const brand = await Brand.findById(brandId);

    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    // Cập nhật trạng thái brand
    brand.isActive = isActive;
    await brand.save();

    let affectedProducts = 0;

    // CASCADE: Chỉ cập nhật sản phẩm và biến thể khi cascade = true
    if (cascade) {
      // Cập nhật trạng thái tất cả sản phẩm thuộc brand này
      const updateProductResult = await Product.updateMany(
        { brand: brandId },
        { isActive: isActive }
      );
      affectedProducts = updateProductResult.modifiedCount;

      // CASCADE: Cập nhật trạng thái tất cả biến thể của các sản phẩm thuộc brand này
      const products = await Product.find({ brand: brandId });
      const productIds = products.map((product) => product._id);

      await Variant.updateMany(
        { product: { $in: productIds } },
        { isActive: isActive }
      );
    }

    const statusMsg = isActive ? "kích hoạt" : "vô hiệu hóa";
    return {
      success: true,
      message: cascade
        ? `Thương hiệu đã được ${statusMsg}. Đã ${statusMsg} ${affectedProducts} sản phẩm liên quan.`
        : `Thương hiệu đã được ${statusMsg} mà không ảnh hưởng đến sản phẩm.`,
      brand,
    };
  },
};

module.exports = brandService;
