const mongoose = require("mongoose");
const Brand = require("../models/brand.model");
const slugify = require("slugify");
const Product = require("../models/product.model");

const brandService = {
  /**
   * Lấy tất cả thương hiệu cho người dùng
   * @returns {Promise<Array>} Danh sách thương hiệu
   */
  getBrandsForUser: async () => {
    return await Brand.find({ isActive: true }); // Chỉ lấy thương hiệu đang hoạt động
  },

  /**
   * Lấy tất cả thương hiệu cho admin
   * @returns {Promise<Array>} Danh sách thương hiệu
   */
  getBrandsForAdmin: async () => {
    return await Brand.find({}); // Lấy tất cả thương hiệu
  },

  /**
   * Lấy chi tiết thương hiệu theo ID
   * @param {String} brandId - ID thương hiệu
   * @returns {Promise<Object>} Thông tin thương hiệu
   */
  getBrandById: async (brandId) => {
    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Tạo thương hiệu mới
   * @param {Object} brandData - Dữ liệu thương hiệu
   * @returns {Promise<Object>} Thương hiệu đã tạo
   */
  createBrand: async (brandData) => {
    const { name } = brandData;

    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error("Tên thương hiệu không được để trống");
    }

    // Kiểm tra trùng lặp
    const existingBrand = await Brand.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (existingBrand) {
      throw new Error("Thương hiệu này đã tồn tại");
    }

    const brand = await Brand.create(brandData);
    return brand;
  },

  /**
   * Cập nhật thương hiệu
   * @param {String} brandId - ID thương hiệu
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Thương hiệu đã cập nhật
   */
  updateBrand: async (id, updateData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID thương hiệu không hợp lệ");
    }

    const { name } = updateData;

    // Validation
    if (name && name.trim().length === 0) {
      throw new Error("Tên thương hiệu không được để trống");
    }

    // Kiểm tra trùng lặp nếu thay đổi tên
    if (name) {
      const existingBrand = await Brand.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: id },
      });
      if (existingBrand) {
        throw new Error("Thương hiệu này đã tồn tại");
      }
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    Object.assign(brand, updateData);
    await brand.save();

    return brand;
  },

  /**
   * Xóa thương hiệu
   * @param {String} brandId - ID thương hiệu
   * @returns {Promise<Boolean>} Kết quả xóa
   */
  deleteBrand: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID thương hiệu không hợp lệ");
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    await brand.remove();
    return { message: "Thương hiệu đã được xóa thành công" };
  },

  /**
   * Toggle trạng thái hoạt động của thương hiệu
   * @param {String} brandId - ID thương hiệu
   * @returns {Promise<Object>} Thương hiệu đã được toggle
   */
  toggleActive: async (brandId) => {
    if (!mongoose.Types.ObjectId.isValid(brandId)) {
      throw new Error("ID không hợp lệ");
    }

    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    // Toggle trạng thái hoạt động của thương hiệu
    brand.isActive = !brand.isActive;
    await brand.save();

    return brand;
  },

  /**
   * Kiểm tra xem thương hiệu có thể xóa được không
   * @param {String} id - ID thương hiệu
   * @returns {Promise<Object>} Kết quả kiểm tra
   */
  checkDeletableBrand: async (id) => {
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    // Logic kiểm tra xem thương hiệu có thể xóa được không
    return { canDelete: true }; // Thay đổi logic theo yêu cầu
  },

  // /**
  //  * Ẩn thương hiệu
  //  * @param {String} id - ID thương hiệu
  //  * @returns {Promise<Object>} Thương hiệu đã ẩn
  //  */
  // hideBrand: async (id) => {
  //   const brand = await Brand.findByIdAndUpdate(
  //     id,
  //     { isActive: false },
  //     { new: true }
  //   );
  //   if (!brand) {
  //     throw new Error("Không tìm thấy thương hiệu");
  //   }
  //   return brand;
  // },

  // /**
  //  * Kích hoạt thương hiệu
  //  * @param {String} id - ID thương hiệu
  //  * @returns {Promise<Object>} Thương hiệu đã kích hoạt
  //  */
  // activateBrand: async (id) => {
  //   const brand = await Brand.findByIdAndUpdate(
  //     id,
  //     { isActive: true },
  //     { new: true }
  //   );
  //   if (!brand) {
  //     throw new Error("Không tìm thấy thương hiệu");
  //   }
  //   return brand;
  // },

  // Lấy tất cả thương hiệu
  getAllBrands: async () => {
    const brands = await Brand.find();
    return brands;
  },

  // Lấy chi tiết thương hiệu
  getBrandDetails: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID thương hiệu không hợp lệ");
    }

    const brand = await Brand.findById(id);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Lấy thương hiệu theo slug
   * @param {String} slug - slug thương hiệu
   * @returns {Promise<Object>} Thương hiệu tìm thấy
   */
  getBrandBySlugForUser: async (slug) => {
    const brand = await Brand.findOne({ slug, isActive: true });
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Lấy thương hiệu theo slug cho admin
   * @param {String} slug - slug thương hiệu
   * @returns {Promise<Object>} Thương hiệu tìm thấy
   */
  getBrandBySlugForAdmin: async (slug) => {
    const brand = await Brand.findOne({ slug });
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  // Kiểm tra điều kiện đầu vào cho thương hiệu
  validateBrandData: (brandData) => {
    const { name } = brandData;
    if (!name || name.trim().length === 0) {
      throw new Error("Tên thương hiệu không được để trống");
    }
  },
};

module.exports = brandService;
