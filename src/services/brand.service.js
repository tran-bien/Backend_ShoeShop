const mongoose = require("mongoose");
const Brand = require("../models/brand.model");
const slugify = require("slugify");
const Product = require("../models/product.model");
const asyncHandler = require("express-async-handler");

const brandService = {
  /**kiểm tra dữ liệu đầu vào có hợp lệ không */
  validateBrandData: (brandData) => {
    const { name, description } = brandData;
    if (!name || name.trim().length === 0) {
      throw new Error("Tên thương hiệu không được để trống");
    }
    if (description && description.trim().length === 0) {
      throw new Error("Mô tả thương hiệu không được để trống");
    }
  },

  /**
   * Tạo thương hiệu mới
   * @param {Object} brandData - Dữ liệu thương hiệu
   * @returns {Promise<Object>} Thương hiệu đã tạo
   */
  createBrand: async (brandData) => {
    validateBrandData(brandData); // Kiểm tra điều kiện đầu vào

    const brand = new Brand(brandData);
    await brand.save();
    return brand;
  },

  /**
   * Cập nhật thương hiệu
   * @param {String} brandId - ID thương hiệu
   * @param {Object} brandData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Thương hiệu đã cập nhật
   */
  updateBrand: async (brandId, brandData) => {
    validateBrandData(brandData); // Kiểm tra điều kiện đầu vào

    const brand = await Brand.findByIdAndUpdate(brandId, brandData, {
      new: true,
      runValidators: true,
    });
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Xóa thương hiệu
   * @param {String} brandId - ID thương hiệu
   * @returns {Promise<Object>} Kết quả xóa
   */
  deleteBrand: async (brandId) => {
    validateBrandId(brandId); // Kiểm tra điều kiện đầu vào

    const brand = await Brand.findByIdAndDelete(brandId);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Toggle trạng thái hoạt động của thương hiệu
   * @param {String} brandId - ID thương hiệu
   * @returns {Promise<Object>} Thương hiệu đã được toggle
   */
  toggleActive: async (brandId) => {
    validateBrandId(brandId); // Kiểm tra điều kiện đầu vào

    const brand = await Brand.findById(brandId);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
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
    // Kiểm tra điều kiện đầu vào
    validateBrandId(id);

    const brand = await Brand.findById(id);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    // Logic kiểm tra xem thương hiệu có thể xóa được không
    return { canDelete: true }; // Thay đổi logic theo yêu cầu
  },

  // Lấy tất cả thương hiệu
  getAllBrandsForAdmin: async () => {
    const brands = await Brand.find();
    return brands;
  },

  getAllBrandsForUser: async () => {
    const brands = await Brand.find({ isActive: true });
    return brands;
  },

  // Lấy chi tiết thương hiệu
  getBrandDetailsForAdmin: async (id) => {
    validateBrandId(id);

    const brand = await Brand.findById(id);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  getBrandDetailsForUser: async (id) => {
    validateBrandId(id);

    const brand = await Brand.findById(id);
  },

  /**
   * Lấy thương hiệu theo slug cho người dùng
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
  validateBrandId: (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID thương hiệu không hợp lệ");
    }
  },
};

module.exports = brandService;
