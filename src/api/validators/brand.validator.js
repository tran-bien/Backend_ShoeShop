const { check, validationResult } = require("express-validator");
const Brand = require("@models/brand/index");

exports.createBrandValidator = [
  check("name")
    .trim()
    .notEmpty()
    .withMessage("Tên thương hiệu là bắt buộc")
    .isLength({ max: 100 })
    .withMessage("Tên thương hiệu không được vượt quá 100 ký tự")
    .custom(async (name) => {
      const existingBrand = await Brand.findOne({ name, deletedAt: null });
      if (existingBrand) {
        throw new Error("Thương hiệu với tên này đã tồn tại");
      }
      return true;
    }),
  check("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Mô tả không được vượt quá 1000 ký tự"),
  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("Trạng thái hoạt động phải là boolean"),
];

exports.updateBrandValidator = [
  check("id").isMongoId().withMessage("ID thương hiệu không hợp lệ"),
  check("name")
    .optional()
    .trim()
    .notEmpty()
    .withMessage("Tên thương hiệu không được để trống")
    .isLength({ max: 100 })
    .withMessage("Tên thương hiệu không được vượt quá 100 ký tự")
    .custom(async (name, { req }) => {
      const existingBrand = await Brand.findOne({
        name,
        _id: { $ne: req.params.id },
        deletedAt: null,
      });
      if (existingBrand) {
        throw new Error("Thương hiệu với tên này đã tồn tại");
      }
      return true;
    }),
  check("description")
    .optional()
    .isLength({ max: 1000 })
    .withMessage("Mô tả không được vượt quá 1000 ký tự"),
  check("isActive")
    .optional()
    .isBoolean()
    .withMessage("Trạng thái hoạt động phải là boolean"),
];

exports.idValidator = [
  check("id").isMongoId().withMessage("ID thương hiệu không hợp lệ"),
];

exports.slugValidator = [
  check("slug")
    .trim()
    .notEmpty()
    .withMessage("Slug thương hiệu không được để trống"),
];

exports.listBrandsValidator = [
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
exports.validateBrand = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
