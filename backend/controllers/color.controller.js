const asyncHandler = require("express-async-handler");
const Color = require("../models/color.model");
const Product = require("../models/product.model");
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose").Types;

// Lấy danh sách màu sắc
exports.getColors = asyncHandler(async (req, res) => {
  const { showAll } = req.query;
  let query = {};

  if (!showAll || showAll === "false") {
    query.status = "active";
  }

  const colors = await Color.find(query).sort({ name: 1 });

  res.json({
    success: true,
    count: colors.length,
    colors,
  });
});

// Tạo màu sắc mới (Admin)
exports.createColor = asyncHandler(async (req, res) => {
  const { name, hexCode } = req.body;

  // Kiểm tra tên màu
  if (!name || name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Tên màu sắc không được để trống",
    });
  }

  // Kiểm tra độ dài tên màu
  if (name.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Tên màu sắc không được vượt quá 50 ký tự",
    });
  }

  // Kiểm tra mã màu
  if (!hexCode || hexCode.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Mã màu không được để trống",
    });
  }

  // Kiểm tra màu đã tồn tại (theo tên, không phân biệt chữ hoa/thường)
  const existingColorByName = await Color.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  if (existingColorByName) {
    return res.status(400).json({
      success: false,
      message: "Tên màu sắc này đã tồn tại",
    });
  }

  // Kiểm tra màu đã tồn tại (theo mã màu)
  const existingColorByHexCode = await Color.findOne({
    hexCode: { $regex: new RegExp(`^${hexCode}$`, "i") },
  });

  if (existingColorByHexCode) {
    return res.status(400).json({
      success: false,
      message: "Mã màu này đã tồn tại",
    });
  }

  // Tạo màu mới
  const color = await Color.create({
    name,
    hexCode,
    status: "active",
  });

  res.status(201).json({
    success: true,
    message: "Đã thêm màu sắc mới",
    color,
  });
});

// Cập nhật màu sắc (Admin)
exports.updateColor = asyncHandler(async (req, res) => {
  const { colorId } = req.params;
  const { name, hexCode, status } = req.body;

  const color = await Color.findById(colorId);
  if (!color) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy màu sắc",
    });
  }

  // Kiểm tra tên màu nếu được cung cấp
  if (name !== undefined) {
    // Kiểm tra tên không được trống
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên màu sắc không được để trống",
      });
    }

    // Kiểm tra độ dài tên
    if (name.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Tên màu sắc không được vượt quá 50 ký tự",
      });
    }

    // Nếu tên thay đổi, kiểm tra trùng lặp
    if (name !== color.name) {
      // Kiểm tra tên màu đã tồn tại
      const existingColor = await Color.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: colorId },
      });

      if (existingColor) {
        return res.status(400).json({
          success: false,
          message: "Tên màu sắc này đã tồn tại",
        });
      }
    }
  }

  // Kiểm tra mã màu nếu được cung cấp
  if (hexCode !== undefined) {
    // Kiểm tra mã màu không được trống
    if (!hexCode || hexCode.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Mã màu không được để trống",
      });
    }

    // Nếu mã màu thay đổi, kiểm tra trùng lặp
    if (hexCode !== color.hexCode) {
      // Kiểm tra mã màu đã tồn tại
      const existingColor = await Color.findOne({
        hexCode: { $regex: new RegExp(`^${hexCode}$`, "i") },
        _id: { $ne: colorId },
      });

      if (existingColor) {
        return res.status(400).json({
          success: false,
          message: "Mã màu này đã tồn tại",
        });
      }
    }
  }

  // Cập nhật thông tin
  if (name) color.name = name;
  if (hexCode !== undefined) color.hexCode = hexCode;
  if (status) color.status = status;

  await color.save();

  res.json({
    success: true,
    message: "Đã cập nhật màu sắc",
    color,
  });
});

// Kiểm tra trước khi xóa (Admin)
exports.checkBeforeDelete = asyncHandler(async (req, res) => {
  const { colorId } = req.params;

  const color = await Color.findById(colorId);
  if (!color) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy màu sắc",
    });
  }

  // Kiểm tra xem màu có đang được sử dụng không trong colors của Product
  const productWithColor = await Product.find({ "colors.color": colorId })
    .select("name _id")
    .limit(10);

  // Kiểm tra xem màu có đang được sử dụng không trong variants của Product
  const productsWithVariants = await Product.aggregate([
    { $match: { "variants.color": new mongoose.Types.ObjectId(colorId) } },
    { $project: { name: 1 } },
    { $limit: 10 },
  ]);

  const hasDependencies =
    productWithColor.length > 0 || productsWithVariants.length > 0;

  res.json({
    success: true,
    canDelete: !hasDependencies,
    hasDependencies,
    dependencies: {
      products: productWithColor,
      variantProducts: productsWithVariants,
      productCount: productWithColor.length,
      variantCount: productsWithVariants.length,
    },
    message: hasDependencies
      ? "Màu sắc đang được sử dụng bởi các sản phẩm"
      : "Có thể xóa màu sắc này",
  });
});

// Vô hiệu hóa màu sắc (Admin)
exports.deactivateColor = asyncHandler(async (req, res) => {
  const { colorId } = req.params;

  const color = await Color.findById(colorId);
  if (!color) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy màu sắc",
    });
  }

  color.status = "inactive";
  await color.save();

  // Cập nhật trạng thái màu sắc trong các biến thể sản phẩm
  await Product.updateMany(
    { "variants.color": colorId },
    { $set: { "variants.$[].deletedColor": true } } // Đánh dấu màu sắc là đã xóa mềm
  );

  res.json({
    success: true,
    message: "Đã vô hiệu hóa màu sắc",
    color,
  });
});

// Kích hoạt lại màu sắc (Admin)
exports.activateColor = asyncHandler(async (req, res) => {
  const { colorId } = req.params;

  const color = await Color.findById(colorId);
  if (!color) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy màu sắc",
    });
  }

  color.status = "active";
  await color.save();

  res.json({
    success: true,
    message: "Đã kích hoạt lại màu sắc",
    color,
  });
});

// Xóa màu sắc (Admin)
exports.deleteColor = asyncHandler(async (req, res) => {
  const { colorId } = req.params;

  // Kiểm tra trước khi xóa
  const color = await Color.findById(colorId);
  if (!color) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy màu sắc",
    });
  }

  // Xóa vĩnh viễn màu sắc
  await Color.deleteOne({ _id: colorId });

  // Xóa màu sắc khỏi các biến thể sản phẩm
  await Product.updateMany(
    { "variants.color": colorId },
    { $pull: { variants: { color: colorId } } } // Xóa màu sắc khỏi biến thể
  );

  res.json({
    success: true,
    message: "Đã xóa màu sắc",
  });
});
