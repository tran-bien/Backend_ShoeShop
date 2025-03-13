const Size = require("../models/size.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

const sizeService = {
  // Lấy danh sách kích thước
  getSizes: async (showAll = false) => {
    let query = {};

    // Nếu không yêu cầu lấy tất cả, không cần điều kiện
    const sizes = await Size.find(query).sort({ value: 1 }); // Lấy tất cả kích thước
    return sizes;
  },

  // Tạo kích thước mới
  createSize: async (sizeData) => {
    const { value, description } = sizeData;

    // Kiểm tra giá trị
    if (!value || isNaN(value)) {
      throw new Error("Giá trị kích thước không hợp lệ");
    }

    // Kiểm tra kích thước đã tồn tại
    const existingSize = await Size.findOne({ value: parseFloat(value) });
    if (existingSize) {
      throw new Error("Kích thước này đã tồn tại");
    }

    // Tạo kích thước mới
    const size = await Size.create({
      value: parseFloat(value),
      description,
      status: "active",
    });

    return size;
  },

  // Cập nhật kích thước
  updateSize: async (sizeId, updateData) => {
    const { value, description, status } = updateData;

    const size = await Size.findById(sizeId);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    // Kiểm tra giá trị nếu được cung cấp
    if (value !== undefined) {
      // Kiểm tra giá trị hợp lệ
      if (isNaN(value)) {
        throw new Error("Giá trị kích thước không hợp lệ");
      }

      // Kiểm tra trùng lặp nếu giá trị thay đổi
      if (parseFloat(value) !== size.value) {
        const existingSize = await Size.findOne({
          value: parseFloat(value),
          _id: { $ne: sizeId },
        });

        if (existingSize) {
          throw new Error("Kích thước này đã tồn tại");
        }
      }
    }

    // Cập nhật thông tin
    if (value !== undefined) size.value = parseFloat(value);
    if (description !== undefined) size.description = description;
    if (status) size.status = status;

    await size.save();
    return size;
  },

  // Xóa kích thước
  deleteSizeWithCheck: async (sizeId) => {
    const size = await Size.findById(sizeId);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    // Kiểm tra xem kích thước có đang được sử dụng không trong variants của Product
    const productsWithVariants = await Product.find({ "variants.size": sizeId })
      .select("name _id variants")
      .limit(10);

    const hasDependencies = productsWithVariants.length > 0;

    if (hasDependencies) {
      throw new Error("Kích thước đang được sử dụng bởi các sản phẩm");
    }

    // Xóa kích thước
    await Size.deleteOne({ _id: sizeId });
    return true;
  },
};

module.exports = sizeService;
