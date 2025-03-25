const { check, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Category = require("@models/category/index");

exports.createCategoryValidator = [
  check("name")
    .trim()
    .notEmpty()
    .withMessage("Tên danh mục là bắt buộc")
    .isLength({ max: 100 })
    .withMessage("Tên danh mục không được vượt quá 100 ký tự")
    .custom(async (name) => {
      const existingCategory = await Category.findOne({
        name,
        deletedAt: null,
      });
      if (existingCategory) {
        throw new Error("Danh mục với tên này đã tồn tại");
      }
      return true;
    }),
  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Mô tả không được vượt quá 500 ký tự"),
  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("Trạng thái hoạt động phải là boolean"),
];

exports.updateCategoryValidator = [
  check("id").isMongoId().withMessage("ID danh mục không hợp lệ"),
  check("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Tên danh mục không được để trống")
    .isLength({ max: 100 })
    .withMessage("Tên danh mục không được vượt quá 100 ký tự")
    .custom(async (name, { req }) => {
      const existingCategory = await Category.findOne({
        name,
        _id: { $ne: req.params.id },
        deletedAt: null,
      });
      if (existingCategory) {
        throw new Error("Danh mục với tên này đã tồn tại");
      }
      return true;
    }),
  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Mô tả không được vượt quá 500 ký tự"),
  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("Trạng thái hoạt động phải là boolean"),
];

exports.idValidator = [
  check("id").isMongoId().withMessage("ID danh mục không hợp lệ"),
];

exports.slugValidator = [
  check("slug")
    .trim()
    .notEmpty()
    .withMessage("Slug danh mục không được để trống"),
];

exports.listCategoriesValidator = [
  check("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Trang phải là số nguyên dương"),
  check("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Giới hạn phải là số nguyên từ 1-100"),
  check("includeDeleted")
    .optional()
    .isBoolean()
    .withMessage("includeDeleted phải là boolean"),
];

// Hàm kiểm tra lỗi
exports.validateCategory = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
