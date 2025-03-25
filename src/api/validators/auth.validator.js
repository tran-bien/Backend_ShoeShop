const { body, param, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const User = require("@models/user");

// Middleware chung để xử lý lỗi validation
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array(),
    });
  }
  next();
};

// Validator cho đăng ký user
exports.validateRegisterInput = [
  body("name").trim().notEmpty().withMessage("Tên không được để trống"),
  body("email")
    .notEmpty()
    .withMessage("Vui lòng cung cấp email")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  handleValidationErrors,
];

// Validator cho mật khẩu (để dùng trong đăng ký hoặc đổi mật khẩu)
exports.validatePassword = [
  body("password")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu")
    .isLength({ min: 8 })
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự")
    .matches(/[A-Za-z]/)
    .withMessage("Mật khẩu phải có ít nhất 1 chữ cái")
    .matches(/\d/)
    .withMessage("Mật khẩu phải có ít nhất 1 số")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Mật khẩu phải có ít nhất 1 ký tự đặc biệt"),
  handleValidationErrors,
];

// Validator cho quên mật khẩu
exports.validateForgotPassword = [
  body("email")
    .notEmpty()
    .withMessage("Vui lòng cung cấp email")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  handleValidationErrors,
];

// Validator cho đặt lại mật khẩu
exports.validateResetPassword = [
  body("resetToken")
    .notEmpty()
    .withMessage("Vui lòng cung cấp token đặt lại mật khẩu"),
  body("password")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu mới và xác nhận mật khẩu")
    .isLength({ min: 8 })
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự")
    .matches(/[A-Za-z]/)
    .withMessage("Mật khẩu phải có ít nhất 1 chữ cái")
    .matches(/\d/)
    .withMessage("Mật khẩu phải có ít nhất 1 số")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Mật khẩu phải có ít nhất 1 ký tự đặc biệt"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Mật khẩu mới và xác nhận mật khẩu không khớp");
    }
    return true;
  }),
  handleValidationErrors,
];

// Validator cho thay đổi mật khẩu
exports.validateChangePassword = [
  body("currentPassword")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu hiện tại"),
  body("newPassword")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu mới")
    .isLength({ min: 8 })
    .withMessage("Mật khẩu mới phải có ít nhất 8 ký tự")
    .matches(/[A-Za-z]/)
    .withMessage("Mật khẩu mới phải có ít nhất 1 chữ cái")
    .matches(/\d/)
    .withMessage("Mật khẩu mới phải có ít nhất 1 số")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("Mật khẩu mới phải khác mật khẩu hiện tại");
      }
      return true;
    }),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Vui lòng xác nhận mật khẩu")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Mật khẩu mới và xác nhận mật khẩu không khớp");
      }
      return true;
    }),
  handleValidationErrors,
];

// Validator cho đăng nhập
exports.validateLoginInput = [
  body("email")
    .notEmpty()
    .withMessage("Vui lòng cung cấp email")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  body("password").notEmpty().withMessage("Vui lòng cung cấp mật khẩu"),
  handleValidationErrors,
];

// Validator cho admin logout user
exports.validateAdminLogoutUser = [
  param("userId")
    .notEmpty()
    .withMessage("Vui lòng cung cấp userId")
    .custom(async (value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("User ID không hợp lệ");
      }
      const user = await User.findById(value);
      if (!user) {
        throw new Error("User không tồn tại");
      }
      return true;
    }),
  handleValidationErrors,
];

// Validator cho xác thực OTP
exports.validateVerifyOTP = [
  body("otp")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mã OTP")
    .isLength({ min: 6, max: 6 })
    .withMessage("Mã OTP phải có 6 ký tự")
    .isNumeric()
    .withMessage("Mã OTP phải là số"),
  body().custom((_, { req }) => {
    if (!req.body.userId && !req.body.email) {
      throw new Error("Vui lòng cung cấp userId hoặc email");
    }
    if (req.body.email && !req.body.email.match(/^\S+@\S+\.\S+$/)) {
      throw new Error("Email không hợp lệ");
    }
    if (req.body.userId && !mongoose.Types.ObjectId.isValid(req.body.userId)) {
      throw new Error("User ID không hợp lệ");
    }
    return true;
  }),
  handleValidationErrors,
];

// Validator cho refresh token
exports.validateRefreshToken = [
  body("refreshToken")
    .notEmpty()
    .withMessage("Vui lòng cung cấp refresh token"),
  handleValidationErrors,
];

// Validator cho logout session
exports.validateLogoutSession = [
  param("sessionId")
    .notEmpty()
    .withMessage("Vui lòng cung cấp sessionId")
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error("Session ID không hợp lệ");
      }
      return true;
    }),
  handleValidationErrors,
];
