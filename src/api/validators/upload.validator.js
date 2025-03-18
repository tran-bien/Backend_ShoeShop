const { check, validationResult } = require("express-validator");

// Validator chung cho upload (một hoặc nhiều file)
exports.uploadFileOneOrMultipleValidation = [
  check("images").custom((value, { req }) => {
    if (!req.files || req.files.length === 0) {
      throw new Error("Vui lòng chọn ít nhất một file để tải lên");
    }
    return true;
  }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator cho xóa file (hỗ trợ publicId hoặc publicIds)
exports.deleteFileOneOrMultipleValidation = [
  // Nếu người dùng cung cấp publicIds thì nó phải là mảng
  check("publicIds")
    .optional()
    .isArray()
    .withMessage("Dữ liệu các mã file cần xóa không đúng định dạng"),
  // Nếu có publicIds, mỗi phần tử phải là chuỗi không rỗng
  check("publicIds.*")
    .optional()
    .isString()
    .withMessage("Mỗi mã file cần xóa phải là văn bản hợp lệ")
    .notEmpty()
    .withMessage("Mã file không được để trống"),
  // Nếu cung cấp publicId thì phải là chuỗi không rỗng
  check("publicId")
    .optional()
    .isString()
    .withMessage("Mã file cần xóa phải là văn bản hợp lệ")
    .notEmpty()
    .withMessage("Mã file không được để trống"),
  // Custom validator: phải có ít nhất một trong số các trường (publicIds hoặc publicId)
  check().custom((value, { req }) => {
    if (
      (!req.body.publicIds || req.body.publicIds.length === 0) &&
      !req.body.publicId
    ) {
      throw new Error("Vui lòng cung cấp ít nhất một mã file cần xóa");
    }
    return true;
  }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];
