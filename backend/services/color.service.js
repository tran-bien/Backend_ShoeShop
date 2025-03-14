const Color = require("../models/color.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;

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
   * Tạo màu sắc mới
   * @param {Object} colorData - Dữ liệu màu sắc
   * @returns {Promise<Object>} Màu sắc đã tạo
   */
  createColor: async (colorData) => {
    const { name, hexCode } = colorData;

    const existingColorByName = await Color.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingColorByName) {
      throw new Error("Tên màu sắc này đã tồn tại");
    }

    const existingColorByHexCode = await Color.findOne({
      hexCode: { $regex: new RegExp(`^${hexCode}$`, "i") },
    });

    if (existingColorByHexCode) {
      throw new Error("Mã màu này đã tồn tại");
    }

    const color = await Color.create({
      name,
      hexCode,
      status: "active",
    });

    return color;
  },

  /**
   * Cập nhật màu sắc
   * @param {String} colorId - ID màu sắc
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Màu sắc đã cập nhật
   */
  updateColor: async (colorId, updateData) => {
    const { name, hexCode, status } = updateData;

    const color = await Color.findById(colorId);
    if (!color) {
      throw new Error("Không tìm thấy màu sắc");
    }

    if (name !== undefined) {
      const existingColor = await Color.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: colorId },
      });

      if (existingColor) {
        throw new Error("Tên màu sắc này đã tồn tại");
      }
    }

    if (hexCode !== undefined) {
      const existingColor = await Color.findOne({
        hexCode: { $regex: new RegExp(`^${hexCode}$`, "i") },
        _id: { $ne: colorId },
      });

      if (existingColor) {
        throw new Error("Mã màu này đã tồn tại");
      }
    }

    if (name) color.name = name;
    if (hexCode !== undefined) color.hexCode = hexCode;
    if (status) color.status = status;

    await color.save();
    return color;
  },

  /**
   * Xóa màu sắc
   * @param {String} colorId - ID màu sắc
   * @returns {Promise<Boolean>} Kết quả xóa
   */
  deleteColor: async (colorId) => {
    // Kiểm tra trước khi xóa
    const color = await Color.findById(colorId);
    if (!color) {
      throw new Error("Không tìm thấy màu sắc");
    }

    // Xóa vĩnh viễn màu sắc
    await Color.deleteOne({ _id: colorId });

    // Xóa màu sắc khỏi các biến thể sản phẩm
    await Product.updateMany(
      { "variants.color": colorId },
      { $pull: { variants: { color: colorId } } } // Xóa màu sắc khỏi biến thể
    );

    return true;
  },

  deleteColorWithCheck: async (colorId) => {
    // Gọi hàm kiểm tra xóa trực tiếp từ colorService
    const { canDelete, message } = await colorService.checkDeletableColor(
      colorId
    );

    if (!canDelete) {
      throw new Error(message); // Nếu không thể xóa, ném lỗi với thông báo
    }

    // Nếu có thể xóa, thực hiện xóa cứng
    await Color.deleteOne({ _id: colorId });
    return true;
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
