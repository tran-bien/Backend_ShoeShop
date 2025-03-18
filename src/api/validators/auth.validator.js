const { check, validationResult } = require("express-validator");

// Validator cho đăng ký user
exports.validateRegisterInput = [
  check("name").trim().notEmpty().withMessage("Tên không được để trống"),
  check("email")
    .notEmpty()
    .withMessage("Vui lòng cung cấp email")
    .isEmail()
    .withMessage("Email không hợp lệ"),
  check("password")
    .notEmpty()
    .withMessage("Mật khẩu không được để trống")
    .isLength({ min: 8 })
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự")
    .matches(/[A-Za-z]/)
    .withMessage("Mật khẩu phải có ít nhất 1 chữ cái")
    .matches(/\d/)
    .withMessage("Mật khẩu phải có ít nhất 1 số")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Mật khẩu phải có ít nhất 1 ký tự đặc biệt"),
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
    .isLength({ min: 8 })
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự")
    .matches(/[A-Za-z]/)
    .withMessage("Mật khẩu phải có ít nhất 1 chữ cái")
    .matches(/\d/)
    .withMessage("Mật khẩu phải có ít nhất 1 số")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Mật khẩu phải có ít nhất 1 ký tự đặc biệt"),
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
    .isLength({ min: 8 })
    .withMessage("Mật khẩu phải có ít nhất 8 ký tự")
    .matches(/[A-Za-z]/)
    .withMessage("Mật khẩu phải có ít nhất 1 chữ cái")
    .matches(/\d/)
    .withMessage("Mật khẩu phải có ít nhất 1 số")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Mật khẩu phải có ít nhất 1 ký tự đặc biệt"),
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
    .isLength({ min: 8 })
    .withMessage("Mật khẩu mới phải có ít nhất 8 ký tự")
    .matches(/[A-Za-z]/)
    .withMessage("Mật khẩu mới phải có ít nhất 1 chữ cái")
    .matches(/\d/)
    .withMessage("Mật khẩu mới phải có ít nhất 1 số")
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage("Mật khẩu mới phải có ít nhất 1 ký tự đặc biệt"),
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

//validator cho adminLogoutUser
exports.validateAdminLogoutUser = [
  check("userId").notEmpty().withMessage("Vui lòng cung cấp userId"),
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
