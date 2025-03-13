const Size = require("../models/size.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

const sizeService = {
  // Lấy danh sách kích thước
  getSizes: async (showAll = false) => {
    let query = {};

    if (!showAll) {
      query.status = "active";
    }

    const sizes = await Size.find(query).sort({ value: 1 });
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

  // Kiểm tra trước khi xóa
  checkBeforeDelete: async (sizeId) => {
    const size = await Size.findById(sizeId);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    // Kiểm tra xem kích thước có đang được sử dụng không trong variants của Product
    const productsWithVariants = await Product.aggregate([
      { $match: { "variants.size": new mongoose.Types.ObjectId(sizeId) } },
      {
        $lookup: {
          from: "colors",
          localField: "variants.color",
          foreignField: "_id",
          as: "colorInfo",
        },
      },
      {
        $project: {
          name: 1,
          variants: {
            $filter: {
              input: "$variants",
              as: "variant",
              cond: {
                $eq: ["$$variant.size", new mongoose.Types.ObjectId(sizeId)],
              },
            },
          },
          colorInfo: 1,
        },
      },
      { $limit: 10 },
    ]);

    const hasDependencies = productsWithVariants.length > 0;

    return {
      canDelete: !hasDependencies,
      hasDependencies,
      dependencies: {
        productsWithVariants: productsWithVariants,
        variantCount: productsWithVariants.length,
      },
      message: hasDependencies
        ? "Kích thước đang được sử dụng bởi các sản phẩm"
        : "Có thể xóa kích thước này",
    };
  },

  // Vô hiệu hóa kích thước
  deactivateSize: async (sizeId) => {
    const size = await Size.findById(sizeId);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    size.status = "inactive";
    await size.save();
    return size;
  },

  // Kích hoạt lại kích thước
  activateSize: async (sizeId) => {
    const size = await Size.findById(sizeId);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    size.status = "active";
    await size.save();
    return size;
  },

  // Xóa kích thước
  deleteSize: async (sizeId) => {
    const size = await Size.findById(sizeId);
    if (!size) {
      throw new Error("Không tìm thấy kích thước");
    }

    // Kiểm tra trước khi xóa
    const checkResult = await sizeService.checkBeforeDelete(sizeId);
    if (!checkResult.canDelete) {
      throw new Error(checkResult.message);
    }

    // Xóa kích thước
    await Size.deleteOne({ _id: sizeId });
    return true;
  },
};

module.exports = sizeService;
