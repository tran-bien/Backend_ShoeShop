const Color = require("../models/color.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;
const { isValidHexColor } = require("../utils/validators");
const colorService = {
  /**
   * Lấy danh sách màu sắc
   * @param {Boolean} showAll - Hiển thị tất cả màu sắc, bao gồm cả không hoạt động
   * @returns {Promise<Array>} Danh sách màu sắc
   */
  getColors: async () => {
    // Lấy tất cả màu sắc mà không cần điều kiện
    const colors = await Color.find({}).sort({ name: 1 }); // Sắp xếp theo tên
    return colors;
  },

  /**
   * Lấy tất cả màu sắc
   * @returns {Promise<Array>} Danh sách màu sắc
   */
  getAllColors: async () => {
    const colors = await Color.find();
    return colors;
  },

  /**
   * Lấy chi tiết màu sắc
   * @param {String} id - ID màu sắc
   * @returns {Promise<Object>} Chi tiết màu sắc
   */
  getColorDetails: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID màu sắc không hợp lệ");
    }

    const color = await Color.findById(id);
    if (!color) {
      throw new Error("Không tìm thấy màu sắc");
    }
    return color;
  },

  /**
   * Tạo màu sắc mới
   * @param {Object} colorData - Dữ liệu màu sắc
   * @returns {Promise<Object>} Màu sắc đã tạo
   */
  createColor: async (colorData) => {
    const { name, hexCode } = colorData;

    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error("Tên màu sắc không được để trống");
    }

    if (!hexCode || hexCode.trim().length === 0) {
      throw new Error("Mã màu không được để trống");
    }

    // Kiểm tra định dạng mã màu hex
    if (!isValidHexColor(hexCode)) {
      throw new Error("Mã màu không hợp lệ");
    }

    // Kiểm tra trùng lặp
    const existingColor = await Color.findOne({
      $or: [{ name }, { hexCode }],
    });
    if (existingColor) {
      throw new Error("Màu sắc này đã tồn tại");
    }

    const color = await Color.create(colorData);
    return color;
  },

  /**
   * Cập nhật màu sắc
   * @param {String} id - ID màu sắc
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Màu sắc đã cập nhật
   */
  updateColor: async (id, updateData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID màu sắc không hợp lệ");
    }

    const { name, hexCode } = updateData;

    // Validation
    if (name && name.trim().length === 0) {
      throw new Error("Tên màu sắc không được để trống");
    }

    if (hexCode && hexCode.trim().length === 0) {
      throw new Error("Mã màu không được để trống");
    }

    // Kiểm tra định dạng mã màu hex nếu có thay đổi
    if (hexCode && !isValidHexColor(hexCode)) {
      throw new Error("Mã màu không hợp lệ");
    }

    // Kiểm tra trùng lặp nếu thay đổi name hoặc hexCode
    if (name || hexCode) {
      const existingColor = await Color.findOne({
        $or: [{ name: name || undefined }, { hexCode: hexCode || undefined }],
        _id: { $ne: id },
      });
      if (existingColor) {
        throw new Error("Màu sắc này đã tồn tại");
      }
    }

    const color = await Color.findById(id);
    if (!color) {
      throw new Error("Không tìm thấy màu sắc");
    }

    Object.assign(color, updateData);
    await color.save();

    return color;
  },

  deleteColorWithCheck: async (id) => {
    const { canDelete, message } = await colorService.checkDeletableColor(id);
    if (!canDelete) {
      throw new Error(message);
    }

    await Color.findByIdAndDelete(id);
    return { message: "Màu sắc đã được xóa thành công" };
  },

  checkDeletableColor: async (colorId) => {
    const color = await Color.findById(colorId);
    if (!color) {
      throw new Error("Không tìm thấy màu sắc");
    }

    // Kiểm tra xem màu có đang được sử dụng không trong variants của Product
    const productsWithVariants = await Product.find({
      "variants.color": colorId,
    })
      .select("name _id variants")
      .limit(10);

    const hasDependencies = productsWithVariants.length > 0;

    return {
      canDelete: !hasDependencies,
      message: hasDependencies
        ? "Màu sắc đang được sử dụng bởi các sản phẩm"
        : "Có thể xóa màu sắc này",
    };
  },
};

module.exports = colorService;
