const asyncHandler = require("express-async-handler");
const Category = require("../models/category.model");
const slugify = require("slugify");

// Lấy tất cả danh mục
exports.getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isActive: true });

  res.status(200).json({
    success: true,
    data: categories,
  });
});

// Lấy chi tiết danh mục theo ID
exports.getCategoryById = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Không tìm thấy danh mục");
  }

  res.status(200).json({
    success: true,
    data: category,
  });
});

// Tạo danh mục mới
exports.createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  // Kiểm tra tên danh mục
  if (!name || name.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Tên danh mục không được để trống",
    });
  }

  // Kiểm tra độ dài tên
  if (name.length > 100) {
    return res.status(400).json({
      success: false,
      message: "Tên danh mục không được vượt quá 100 ký tự",
    });
  }

  // Tạo slug từ tên
  const slug = slugify(name, { lower: true });

  // Kiểm tra danh mục đã tồn tại (theo tên chính xác)
  const existingCategoryByName = await Category.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  if (existingCategoryByName) {
    return res.status(400).json({
      success: false,
      message: "Tên danh mục này đã tồn tại",
    });
  }

  // Kiểm tra danh mục đã tồn tại (theo slug)
  const existingCategoryBySlug = await Category.findOne({ slug });
  if (existingCategoryBySlug) {
    return res.status(400).json({
      success: false,
      message: "Danh mục này đã tồn tại với tên tương tự",
    });
  }

  // Tạo danh mục mới
  const category = await Category.create({
    name,
    description,
    slug,
  });

  res.status(201).json({
    success: true,
    data: category,
  });
});

// Cập nhật danh mục
exports.updateCategory = asyncHandler(async (req, res) => {
  const { name, description, isActive } = req.body;
  let category = await Category.findById(req.params.id);

  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Không tìm thấy danh mục",
    });
  }

  // Kiểm tra nếu tên được cung cấp
  if (name !== undefined) {
    // Kiểm tra tên không được trống
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên danh mục không được để trống",
      });
    }

    // Kiểm tra độ dài tên
    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Tên danh mục không được vượt quá 100 ký tự",
      });
    }

    // Cập nhật slug nếu tên thay đổi
    if (name !== category.name) {
      const slug = slugify(name, { lower: true });

      // Kiểm tra tên đã tồn tại (theo tên chính xác)
      const existingCategoryByName = await Category.findOne({
        name: { $regex: new RegExp(`^${name}$`, "i") },
        _id: { $ne: req.params.id },
      });

      if (existingCategoryByName) {
        return res.status(400).json({
          success: false,
          message: "Tên danh mục này đã tồn tại",
        });
      }

      // Kiểm tra slug đã tồn tại
      const existingCategory = await Category.findOne({
        slug,
        _id: { $ne: req.params.id },
      });

      if (existingCategory) {
        return res.status(400).json({
          success: false,
          message: "Danh mục với tên này đã tồn tại",
        });
      }

      category.slug = slug;
    }
  }

  // Cập nhật thông tin
  if (name) category.name = name;
  if (description !== undefined) category.description = description;
  if (isActive !== undefined) category.isActive = isActive;

  await category.save();

  res.status(200).json({
    success: true,
    data: category,
  });
});

// Xóa danh mục
exports.deleteCategory = asyncHandler(async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    res.status(404);
    throw new Error("Không tìm thấy danh mục");
  }

  // Xóa mềm - chỉ đánh dấu không còn hoạt động
  category.isActive = false;
  await category.save();

  res.status(200).json({
    success: true,
    message: "Đã xóa danh mục thành công",
  });
});
