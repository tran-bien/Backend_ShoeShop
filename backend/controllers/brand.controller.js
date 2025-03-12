const asyncHandler = require("express-async-handler");
const Brand = require("../models/brand.model");
const slugify = require("slugify");

// Lấy tất cả thương hiệu
exports.getBrands = asyncHandler(async (req, res) => {
  const brands = await Brand.find({ isActive: true });

  res.status(200).json({
    success: true,
    data: brands,
  });
});

// Lấy chi tiết thương hiệu theo ID
exports.getBrandById = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);

  if (!brand) {
    res.status(404);
    throw new Error("Không tìm thấy thương hiệu");
  }

  res.status(200).json({
    success: true,
    data: brand,
  });
});

// Tạo thương hiệu mới
exports.createBrand = asyncHandler(async (req, res) => {
  const { name, description, logo } = req.body;

  // Kiểm tra tên thương hiệu
  if (!name || name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Tên thương hiệu không được để trống",
    });
  }

  // Kiểm tra độ dài tên
  if (name.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Tên thương hiệu không được vượt quá 100 ký tự",
    });
  }

  // Tạo slug từ tên
  const slug = slugify(name, { lower: true });

  // Kiểm tra thương hiệu đã tồn tại (theo tên chính xác)
  const existingBrandByName = await Brand.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  if (existingBrandByName) {
    return res.status(400).json({
      success: false,
      message: "Tên thương hiệu này đã tồn tại",
    });
  }

  // Kiểm tra thương hiệu đã tồn tại (theo slug)
  const existingBrandBySlug = await Brand.findOne({ slug });
  if (existingBrandBySlug) {
    return res.status(400).json({
      success: false,
      message: "Thương hiệu này đã tồn tại với tên tương tự",
    });
  }

  // Tạo thương hiệu mới
  const brand = await Brand.create({
    name,
    description,
    logo,
    slug,
  });

  res.status(201).json({
    success: true,
    data: brand,
  });
});

// Cập nhật thương hiệu
exports.updateBrand = asyncHandler(async (req, res) => {
  const { name, description, logo, isActive } = req.body;
  let brand = await Brand.findById(req.params.id);

  if (!brand) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy thương hiệu",
    });
  }

  // Kiểm tra nếu tên được cung cấp
  if (name !== undefined) {
    // Kiểm tra tên không được trống
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên thương hiệu không được để trống",
      });
    }

    // Kiểm tra độ dài tên
    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Tên thương hiệu không được vượt quá 100 ký tự",
      });
    }

    // Cập nhật slug nếu tên thay đổi
    if (name !== brand.name) {
      const slug = slugify(name, { lower: true });

      // Kiểm tra tên đã tồn tại (theo tên chính xác)
      const existingBrandByName = await Brand.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: req.params.id },
      });

      if (existingBrandByName) {
        return res.status(400).json({
          success: false,
          message: "Tên thương hiệu này đã tồn tại",
        });
      }

      // Kiểm tra slug đã tồn tại
      const existingBrand = await Brand.findOne({
        slug,
        _id: { $ne: req.params.id },
      });

      if (existingBrand) {
        return res.status(400).json({
          success: false,
          message: "Thương hiệu với tên này đã tồn tại",
        });
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

  res.status(200).json({
    success: true,
    data: brand,
  });
});

// Xóa thương hiệu
exports.deleteBrand = asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.params.id);

  if (!brand) {
    res.status(404);
    throw new Error("Không tìm thấy thương hiệu");
  }

  // Xóa mềm - chỉ đánh dấu không còn hoạt động
  brand.isActive = false;
  await brand.save();

  res.status(200).json({
    success: true,
    message: "Đã xóa thương hiệu thành công",
  });
});
