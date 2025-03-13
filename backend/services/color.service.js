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

    // Kiểm tra tên màu
    if (!name || name.trim() === "") {
      throw new Error("Tên màu sắc không được để trống");
    }

    // Kiểm tra độ dài tên màu
    if (name.length > 50) {
      throw new Error("Tên màu sắc không được vượt quá 50 ký tự");
    }

    // Kiểm tra mã màu
    if (!hexCode || hexCode.trim() === "") {
      throw new Error("Mã màu không được để trống");
    }

    // Kiểm tra màu đã tồn tại (theo tên, không phân biệt chữ hoa/thường)
    const existingColorByName = await Color.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });

    if (existingColorByName) {
      throw new Error("Tên màu sắc này đã tồn tại");
    }

    // Kiểm tra màu đã tồn tại (theo mã màu)
    const existingColorByHexCode = await Color.findOne({
      hexCode: { $regex: new RegExp(`^${hexCode}$`, "i") },
    });

    if (existingColorByHexCode) {
      throw new Error("Mã màu này đã tồn tại");
    }

    // Tạo màu mới
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

    // Kiểm tra tên màu nếu được cung cấp
    if (name !== undefined) {
      // Kiểm tra tên không được trống
      if (!name || name.trim() === "") {
        throw new Error("Tên màu sắc không được để trống");
      }

      // Kiểm tra độ dài tên
      if (name.length > 50) {
        throw new Error("Tên màu sắc không được vượt quá 50 ký tự");
      }

      // Nếu tên thay đổi, kiểm tra trùng lặp
      if (name !== color.name) {
        // Kiểm tra tên màu đã tồn tại
        const existingColor = await Color.findOne({
          name: { $regex: new RegExp(`^${name}$`, "i") },
          _id: { $ne: colorId },
        });

        if (existingColor) {
          throw new Error("Tên màu sắc này đã tồn tại");
        }
      }
    }

    // Kiểm tra mã màu nếu được cung cấp
    if (hexCode !== undefined) {
      // Kiểm tra mã màu không được trống
      if (!hexCode || hexCode.trim() === "") {
        throw new Error("Mã màu không được để trống");
      }

      // Nếu mã màu thay đổi, kiểm tra trùng lặp
      if (hexCode !== color.hexCode) {
        // Kiểm tra mã màu đã tồn tại
        const existingColor = await Color.findOne({
          hexCode: { $regex: new RegExp(`^${hexCode}$`, "i") },
          _id: { $ne: colorId },
        });

        if (existingColor) {
          throw new Error("Mã màu này đã tồn tại");
        }
      }
    }

    // Cập nhật thông tin
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

    if (hasDependencies) {
      throw new Error("Màu sắc đang được sử dụng bởi các sản phẩm");
    }

    // Xóa màu sắc
    await Color.deleteOne({ _id: colorId });
    return true;
  },
};

module.exports = colorService;
