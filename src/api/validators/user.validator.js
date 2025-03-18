const { body } = require("express-validator");

exports.createUserValidator = [
  body("email").isEmail().withMessage("Email không hợp lệ"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự"),
  body("name").notEmpty().withMessage("Tên không được để trống"),
];
