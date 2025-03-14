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
   * @param {String} id - ID thương hiệu
   * @param {Boolean} isAdmin - Kiểm tra xem người dùng có phải là admin không
   * @returns {Promise<Object>} Thông tin thương hiệu user không xem được thương hiệu ẩn admin xem được tất cả
   */

  getBrandById: async (brandId, isAdmin = false) => {
    const query = isAdmin ? { _id: brandId } : { _id: brandId, isActive: true }; // Nếu là admin, lấy tất cả
    const brand = await Brand.findOne(query);
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
    const brand = new Brand(brandData);
    return await brand.save();
  },

  /**
   * Cập nhật thương hiệu
   * @param {String} id - ID thương hiệu
   * @param {Object} brandData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Thương hiệu đã cập nhật
   */
  updateBrand: async (id, brandData) => {
    const brand = await Brand.findByIdAndUpdate(id, brandData, { new: true });
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Xóa thương hiệu (xóa mềm)
   * @param {String} id - ID thương hiệu
   * @returns {Promise<Boolean>} Kết quả xóa
   */
  deleteBrand: async (id) => {
    const brand = await Brand.findByIdAndDelete(id);
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return { success: true, message: "Thương hiệu đã được xóa" };
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

  /**
   * Ẩn thương hiệu
   * @param {String} id - ID thương hiệu
   * @returns {Promise<Object>} Thương hiệu đã ẩn
   */
  hideBrand: async (id) => {
    const brand = await Brand.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },

  /**
   * Kích hoạt thương hiệu
   * @param {String} id - ID thương hiệu
   * @returns {Promise<Object>} Thương hiệu đã kích hoạt
   */
  activateBrand: async (id) => {
    const brand = await Brand.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );
    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }
    return brand;
  },
};

module.exports = brandService;
