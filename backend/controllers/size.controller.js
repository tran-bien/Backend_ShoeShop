const asyncHandler = require("express-async-handler");
const Size = require("../models/size.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");

// Lấy danh sách kích thước
exports.getSizes = asyncHandler(async (req, res) => {
  const { showAll } = req.query;
  let query = {};

  if (!showAll || showAll === "false") {
    query.status = "active";
  }

  const sizes = await Size.find(query).sort({ value: 1 });

  res.json({
    success: true,
    count: sizes.length,
    sizes,
  });
});

// Tạo kích thước mới (Admin)
exports.createSize = asyncHandler(async (req, res) => {
  const { value, description } = req.body;

  // Kiểm tra giá trị
  if (!value || isNaN(value)) {
    return res.status(400).json({
      success: false,
      message: "Giá trị kích thước không hợp lệ",
    });
  }

  // Kiểm tra kích thước đã tồn tại
  const existingSize = await Size.findOne({ value });
  if (existingSize) {
    return res.status(400).json({
      success: false,
      message: "Kích thước này đã tồn tại",
    });
  }

  // Tạo kích thước mới
  const size = await Size.create({
    value: parseFloat(value),
    description,
    status: "active",
  });

  res.status(201).json({
    success: true,
    message: "Đã thêm kích thước mới",
    size,
  });
});

// Cập nhật kích thước (Admin)
exports.updateSize = asyncHandler(async (req, res) => {
  const { sizeId } = req.params;
  const { value, description, status } = req.body;

  const size = await Size.findById(sizeId);
  if (!size) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy kích thước",
    });
  }

  // Kiểm tra giá trị nếu được cung cấp
  if (value !== undefined) {
    // Kiểm tra giá trị hợp lệ
    if (isNaN(value)) {
      return res.status(400).json({
        success: false,
        message: "Giá trị kích thước không hợp lệ",
      });
    }

    // Kiểm tra trùng lặp nếu giá trị thay đổi
    if (parseFloat(value) !== size.value) {
      const existingSize = await Size.findOne({
        value: parseFloat(value),
        _id: { $ne: sizeId },
      });

      if (existingSize) {
        return res.status(400).json({
          success: false,
          message: "Kích thước này đã tồn tại",
        });
      }
    }
  }

  // Cập nhật thông tin
  if (value !== undefined) size.value = parseFloat(value);
  if (description !== undefined) size.description = description;
  if (status) size.status = status;

  await size.save();

  res.json({
    success: true,
    message: "Đã cập nhật kích thước",
    size,
  });
});

// Kiểm tra trước khi xóa (Admin)
exports.checkBeforeDelete = asyncHandler(async (req, res) => {
  const { sizeId } = req.params;

  const size = await Size.findById(sizeId);
  if (!size) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy kích thước",
    });
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

  res.json({
    success: true,
    canDelete: !hasDependencies,
    hasDependencies,
    dependencies: {
      productsWithVariants: productsWithVariants,
      variantCount: productsWithVariants.length,
    },
    message: hasDependencies
      ? "Kích thước đang được sử dụng bởi các sản phẩm"
      : "Có thể xóa kích thước này",
  });
});

// Vô hiệu hóa kích thước (Admin)
exports.deactivateSize = asyncHandler(async (req, res) => {
  const { sizeId } = req.params;

  const size = await Size.findById(sizeId);
  if (!size) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy kích thước",
    });
  }

  size.status = "inactive";
  await size.save();

  res.json({
    success: true,
    message: "Đã vô hiệu hóa kích thước",
    size,
  });
});

// Kích hoạt lại kích thước (Admin)
exports.activateSize = asyncHandler(async (req, res) => {
  const { sizeId } = req.params;

  const size = await Size.findById(sizeId);
  if (!size) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy kích thước",
    });
  }

  size.status = "active";
  await size.save();

  res.json({
    success: true,
    message: "Đã kích hoạt lại kích thước",
    size,
  });
});

// Xóa kích thước (Admin)
exports.deleteSize = asyncHandler(async (req, res) => {
  const { sizeId } = req.params;

  // Kiểm tra trước khi xóa
  const checkResult = await checkBeforeDelete(req, res);
  if (!checkResult.canDelete) {
    return res.status(400).json(checkResult);
  }

  // Sử dụng phương thức deleteOne thay vì remove
  await Size.deleteOne({ _id: sizeId });

  res.json({
    success: true,
    message: "Đã xóa kích thước",
  });
});
