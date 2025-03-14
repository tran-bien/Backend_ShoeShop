const Size = require("../models/size.model");
const Product = require("../models/product.model");

const sizeService = {
  // Lấy danh sách kích thước
  getSizes: async () => {
    const sizes = await Size.find({}).sort({ value: 1 });
    return sizes;
  },

  // Tạo kích thước mới
  createSize: async (sizeData) => {
    const { value, description } = sizeData;

    const existingSize = await Size.findOne({ value: parseFloat(value) });
    if (existingSize) {
      throw new Error("Kích thước này đã tồn tại");
    }

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

    if (value !== undefined) {
      const existingSize = await Size.findOne({
        value: parseFloat(value),
        _id: { $ne: sizeId },
      });

      if (existingSize) {
        throw new Error("Kích thước này đã tồn tại");
      }
    }

    if (value !== undefined) size.value = parseFloat(value);
    if (description !== undefined) size.description = description;
    if (status) size.status = status;

    await size.save();
    return size;
  },

  // Xóa kích thước
  deleteSizeWithCheck: async (sizeId) => {
    const { canDelete, message } = await sizeService.checkDeletableSize(sizeId);

    if (!canDelete) {
      throw new Error(message);
    }

    await Size.deleteOne({ _id: sizeId });
    return true;
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
