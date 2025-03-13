const Brand = require("../models/brand.model");
const slugify = require("slugify");

const brandService = {
  /**
   * Lấy tất cả thương hiệu đang hoạt động
   * @returns {Promise<Array>} Danh sách thương hiệu
   */
  getBrands: async () => {
    const brands = await Brand.find({ isActive: true });
    return brands;
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
    const { name, description, logo } = brandData;

    // Kiểm tra tên thương hiệu
    if (!name || name.trim() === "") {
      throw new Error("Tên thương hiệu không được để trống");
    }

    // Kiểm tra độ dài tên
    if (name.length > 100) {
      throw new Error("Tên thương hiệu không được vượt quá 100 ký tự");
    }

    // Tạo slug từ tên
    const slug = slugify(name, { lower: true });

    // Kiểm tra thương hiệu đã tồn tại (theo tên chính xác)
    const existingBrandByName = await Brand.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingBrandByName) {
      throw new Error("Tên thương hiệu này đã tồn tại");
    }

    // Kiểm tra thương hiệu đã tồn tại (theo slug)
    const existingBrandBySlug = await Brand.findOne({ slug });
    if (existingBrandBySlug) {
      throw new Error("Thương hiệu này đã tồn tại với tên tương tự");
    }

    // Tạo thương hiệu mới
    const brand = await Brand.create({
      name,
      description,
      logo,
      slug,
    });

    return brand;
  },

  /**
   * Cập nhật thương hiệu
   * @param {String} brandId - ID thương hiệu
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Thương hiệu đã cập nhật
   */
  updateBrand: async (brandId, updateData) => {
    const { name, description, logo, isActive } = updateData;
    let brand = await Brand.findById(brandId);

    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    // Kiểm tra nếu tên được cung cấp
    if (name !== undefined) {
      // Kiểm tra tên không được trống
      if (!name || name.trim() === "") {
        throw new Error("Tên thương hiệu không được để trống");
      }

      // Kiểm tra độ dài tên
      if (name.length > 100) {
        throw new Error("Tên thương hiệu không được vượt quá 100 ký tự");
      }

      // Cập nhật slug nếu tên thay đổi
      if (name !== brand.name) {
        const slug = slugify(name, { lower: true });

        // Kiểm tra tên đã tồn tại (theo tên chính xác)
        const existingBrandByName = await Brand.findOne({
          name: { $regex: new RegExp(`^${name}$`, "i") },
          _id: { $ne: brandId },
        });

        if (existingBrandByName) {
          throw new Error("Tên thương hiệu này đã tồn tại");
        }

        // Kiểm tra slug đã tồn tại
        const existingBrand = await Brand.findOne({
          slug,
          _id: { $ne: brandId },
        });

        if (existingBrand) {
          throw new Error("Thương hiệu với tên này đã tồn tại");
        }

        brand.slug = slug;
      }
    }

    // Cập nhật thông tin
    if (name) brand.name = name;
    if (description !== undefined) brand.description = description;
    if (logo !== undefined) brand.logo = logo;
    if (isActive !== undefined) brand.isActive = isActive;

    await brand.save();
    return brand;
  },

  /**
   * Xóa thương hiệu (xóa mềm)
   * @param {String} brandId - ID thương hiệu
   * @returns {Promise<Boolean>} Kết quả xóa
   */
  deleteBrand: async (brandId) => {
    const brand = await Brand.findById(brandId);

    if (!brand) {
      throw new Error("Không tìm thấy thương hiệu");
    }

    // Xóa mềm - chỉ đánh dấu không còn hoạt động
    brand.isActive = false;
    await brand.save();

    return true;
  },
};

module.exports = brandService;
