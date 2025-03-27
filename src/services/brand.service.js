const { Brand, Product, Variant } = require("@models");
const paginate = require("@utils/pagination");

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

    if (isActive !== undefined) {
      filter.isActive = isActive;
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

    return brand;
  },

  /**
   * [ADMIN] Lấy danh sách brand đã xóa mềm
   */
  getDeletedBrands: async (query) => {
    try {
      const { page = 1, limit = 10, name, sort } = query;

      // Chuẩn bị filter
      let filter = {};

      if (name) {
        filter.name = { $regex: name, $options: "i" };
      }

      // Sử dụng phương thức cải tiến findDeleted
      const sortOption = sort ? JSON.parse(sort) : { deletedAt: -1 };

      // Lấy danh sách brand đã xóa với phân trang
      const brands = await Brand.findDeleted(filter, {
        page,
        limit,
        sort: sortOption,
      });

      // Đếm tổng số brand đã xóa
      const totalItems = await Brand.countDeleted(filter);
      const totalPages = Math.ceil(totalItems / parseInt(limit));

      return {
        success: true,
        data: brands,
        pagination: {
          totalItems,
          currentPage: parseInt(page),
          pageSize: parseInt(limit),
          totalPages,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
        },
      };
    } catch (error) {
      console.error("Lỗi khi lấy danh sách brand đã xóa:", error);
      throw new Error("Không thể lấy danh sách thương hiệu đã xóa");
    }
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

    return brand;
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

    return brand;
  },

  // === COMMON OPERATIONS ===

  /**
   * Tạo brand mới
   */
  createBrand: async (brandData) => {
    try {
      // Đảm bảo isActive mặc định là true nếu không được cung cấp
      if (brandData.isActive === undefined) {
        brandData.isActive = true;
      }

      const brand = new Brand(brandData);
      await brand.save();
      return brand;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error("Tên thương hiệu đã tồn tại");
      }
      throw error;
    }
  },

  /**
   * Cập nhật brand
   */
  updateBrand: async (brandId, brandData) => {
    try {
      const brand = await Brand.findById(brandId);
      if (!brand) {
        throw new Error("Không tìm thấy thương hiệu");
      }

      // Cập nhật từng trường thay vì Object.assign để xử lý thêm logic nếu cần
      if (brandData.name !== undefined) brand.name = brandData.name;
      if (brandData.description !== undefined)
        brand.description = brandData.description;
      if (brandData.isActive !== undefined) brand.isActive = brandData.isActive;
      if (brandData.logo !== undefined) brand.logo = brandData.logo;

      // Các trường audit được thêm tự động bởi middleware

      await brand.save();
      return brand;
    } catch (error) {
      if (error.code === 11000) {
        throw new Error("Tên thương hiệu đã tồn tại");
      }
      throw error;
    }
  },

  /**
   * Xóa mềm brand (chuyển method từ model vào service)
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

    return { message: "Xóa thương hiệu thành công" };
  },

  /**
   * Khôi phục brand đã xóa mềm (chuyển method từ model vào service)
   */
  restoreBrand: async (brandId) => {
    try {
      // Sử dụng phương thức restoreById từ plugin
      const brand = await Brand.restoreById(brandId);

      return {
        message: "Khôi phục thương hiệu thành công",
        brand,
      };
    } catch (error) {
      console.error("Lỗi khôi phục brand:", error);
      throw new Error("Không tìm thấy thương hiệu");
    }
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
      message: cascade
        ? `Thương hiệu đã được ${statusMsg}. Đã ${statusMsg} ${affectedProducts} sản phẩm liên quan.`
        : `Thương hiệu đã được ${statusMsg} mà không ảnh hưởng đến sản phẩm.`,
      brand,
    };
  },
};

module.exports = brandService;
