const Size = require("../models/size.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

const sizeService = {
  // Lấy tất cả kích thước
  getAllSizes: async () => {
    const sizes = await Size.find();
    return sizes;
  },

  // Lấy chi tiết kích thước
  getSizeDetails: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID kích thước không hợp lệ");
    }

    const size = await Size.findById(id);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }
    return size;
  },

  // Tạo kích thước mới
  createSize: async (sizeData) => {
    const { value, description } = sizeData;

    // Validation
    if (!value || value.trim().length === 0) {
      throw new Error("Giá trị kích thước không được để trống");
    }

    if (description && description.trim().length === 0) {
      throw new Error("Mô tả kích thước không được để trống");
    }

    // Kiểm tra trùng lặp
    const existingSize = await Size.findOne({ value });
    if (existingSize) {
      throw new Error("Kích thước này đã tồn tại");
    }

    const size = await Size.create(sizeData);
    return size;
  },

  // Cập nhật kích thước
  updateSize: async (id, updateData) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID kích thước không hợp lệ");
    }

    const { value, description } = updateData;

    // Validation
    if (value && value.trim().length === 0) {
      throw new Error("Giá trị kích thước không được để trống");
    }

    if (description && description.trim().length === 0) {
      throw new Error("Mô tả kích thước không được để trống");
    }

    // Kiểm tra trùng lặp nếu thay đổi value
    if (value) {
      const existingSize = await Size.findOne({ value, _id: { $ne: id } });
      if (existingSize) {
        throw new Error("Kích thước này đã tồn tại");
      }
    }

    const size = await Size.findById(id);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    Object.assign(size, updateData);
    await size.save();

    return size;
  },

  // Xóa kích thước
  deleteSize: async (id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("ID kích thước không hợp lệ");
    }

    const size = await Size.findById(id);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    await size.remove();
    return { message: "Kích thước đã được xóa thành công" };
  },

  checkDeletableSize: async (sizeId) => {
    const size = await Size.findById(sizeId);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    const productsWithVariants = await Product.find({ "variants.size": sizeId })
      .select("name _id variants")
      .limit(10);

    const hasDependencies = productsWithVariants.length > 0;

    return {
      canDelete: !hasDependencies,
      message: hasDependencies
        ? "Kích thước đang được sử dụng bởi các sản phẩm"
        : "Có thể xóa kích thước này",
    };
  },
};

module.exports = sizeService;
