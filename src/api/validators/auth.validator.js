const { check, validationResult } = require("express-validator");

// Validator cho đăng ký user
exports.validateRegisterInput = [
  check("name").trim().notEmpty().withMessage("Tên không được để trống"),
  check("email")
    .notEmpty()
    .withMessage("Vui lòng cung cấp email")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator cho mật khẩu (để dùng trong đăng ký hoặc đổi mật khẩu)
exports.validatePassword = [
  check("password")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự, bao gồm 1 chữ cái và 1 số"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator cho quên mật khẩu
exports.validateForgotPassword = [
  check("email")
    .notEmpty()
    .withMessage("Vui lòng cung cấp email")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator cho đặt lại mật khẩu
exports.validateResetPassword = [
  check("resetToken")
    .notEmpty()
    .withMessage("Vui lòng cung cấp token đặt lại mật khẩu"),
  check("password")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu mới và xác nhận mật khẩu")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự, bao gồm 1 chữ cái và 1 số"),
  check("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error("Mật khẩu mới và xác nhận mật khẩu không khớp");
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

// Validator cho thay đổi mật khẩu
exports.validateChangePassword = [
  check("currentPassword")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu hiện tại"),
  check("newPassword")
    .notEmpty()
    .withMessage("Vui lòng cung cấp mật khẩu mới và xác nhận mật khẩu")
    .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/)
    .withMessage(
      "Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm 1 chữ cái và 1 số"
    ),
  check("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error("Mật khẩu mới và xác nhận mật khẩu không khớp");
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

// Validator cho đăng nhập
exports.validateLoginInput = [
  check("email").notEmpty().withMessage("Vui lòng cung cấp email"),
  check("password").notEmpty().withMessage("Vui lòng cung cấp mật khẩu"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
];

// Validator cho xác thực OTP
exports.validateVerifyOTP = [
  check("otp").notEmpty().withMessage("Vui lòng cung cấp mã OTP"),
  check().custom((_, { req }) => {
    if (!req.body.userId && !req.body.email) {
      throw new Error("Vui lòng cung cấp userId hoặc email");
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
