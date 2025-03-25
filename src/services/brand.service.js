const { Brand } = require("@models");
const paginate = require("@utils/pagination");

const brandService = {
  /**
   * Lấy danh sách thương hiệu với phân trang (chỉ lấy các thương hiệu active và chưa xóa)
   */
  getAllBrands: async (query) => {
    const { page = 1, limit = 10, name, isActive, sort } = query;

    // Xây dựng query filter
    const filter = {};

    // Filter theo tên (tìm kiếm không phân biệt hoa thường)
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Filter theo trạng thái active
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    // Tạo options cho paginate
    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { createdAt: -1 },
    };

    return await paginate(Brand, filter, options);
  },

  /**
   * Lấy thông tin một thương hiệu theo ID (bao gồm cả đã xóa nếu là admin)
   */
  getBrandById: async (brandId, includeDeleted = false) => {
    const query = { _id: brandId };
    if (includeDeleted) {
      query.includeDeleted = true;
    }
    const brand = await Brand.findOne(query);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Lấy thương hiệu theo slug
   */
  getBrandBySlug: async (slug) => {
    const brand = await Brand.findOne({ slug, isActive: true });
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Tạo thương hiệu mới
   */
  createBrand: async (brandData) => {
    try {
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
   * Cập nhật thương hiệu
   */
  updateBrand: async (brandId, brandData) => {
    try {
      const brand = await Brand.findById(brandId);
      if (!brand) {
        throw new Error("Không tìm thấy thương hiệu");
      }

      Object.assign(brand, brandData);
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
   * Xóa mềm thương hiệu
   */
  deleteBrand: async (brandId, userId) => {
    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    await brand.softDelete(userId);
    return { message: "Xóa thương hiệu thành công" };
  },

  /**
   * Khôi phục thương hiệu đã xóa mềm
   */
  restoreBrand: async (brandId) => {
    const brand = await Brand.findOne({ _id: brandId, includeDeleted: true });
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    if (!brand.deletedAt) {
      throw new Error("Thương hiệu chưa bị xóa");
    }

    await brand.restore();
    return { message: "Khôi phục thương hiệu thành công", brand };
  },

  /**
   * Danh sách thương hiệu đã xóa (chỉ dành cho admin)
   */
  getDeletedBrands: async (query) => {
    const { page = 1, limit = 10, name, sort } = query;

    // Xây dựng query filter để lấy chỉ các thương hiệu đã xóa
    const filter = { deletedAt: { $ne: null }, includeDeleted: true };

    // Filter theo tên (tìm kiếm không phân biệt hoa thường)
    if (name) {
      filter.name = { $regex: name, $options: "i" };
    }

    // Tạo options cho paginate
    const options = {
      page,
      limit,
      sort: sort ? JSON.parse(sort) : { deletedAt: -1 },
    };

    return await paginate(Brand, filter, options);
  },

  /**
   * Cập nhật trạng thái active
   */
  updateBrandStatus: async (brandId, isActive) => {
    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    brand.isActive = isActive;
    await brand.save();
    return {
      message: `Thương hiệu đã được ${isActive ? "kích hoạt" : "vô hiệu hóa"}`,
      brand,
    };
  },
};

module.exports = brandService;
