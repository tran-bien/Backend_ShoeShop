const { checkPasswordRequirements } = require("../utils/validators");
const { isValidEmail } = require("../utils/validators");

const validatePassword = (req, res, next) => {
  const { password } = req.body;
  const passwordErrors = checkPasswordRequirements(password);

  if (passwordErrors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Mật khẩu không hợp lệ",
      errors: {
        password: passwordErrors,
      },
    });
  }

  next();
};

const validateRegisterInput = (req, res, next) => {
  const { name, email, password } = req.body;
  const errors = {};

  // Kiểm tra tên
  if (!name || name.trim() === "") {
    errors.name = ["Tên không được để trống"];
  }

  // Kiểm tra email
  if (!email) {
    errors.email = ["Email không được để trống"];
  } else if (!isValidEmail(email)) {
    errors.email = ["Địa chỉ email không hợp lệ"];
  }

  // Kiểm tra mật khẩu - chỉ kiểm tra có không, chi tiết kiểm tra ở middleware validatePassword
  if (!password) {
    errors.password = ["Mật khẩu không được để trống"];
  }

  // Nếu có lỗi, trả về lỗi validation
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu đăng ký không hợp lệ",
      errors,
    });
  }

  next();
};

const validateResetPassword = (req, res, next) => {
  const { password, confirmPassword } = req.body;
  const errors = {};

  // Kiểm tra mật khẩu và xác nhận mật khẩu
  if (password !== confirmPassword) {
    errors.confirmPassword = ["Mật khẩu và xác nhận mật khẩu không khớp"];
  }

  // Kiểm tra mật khẩu bằng hàm tiện ích
  const passwordErrors = checkPasswordRequirements(password);
  if (passwordErrors.length > 0) {
    errors.password = passwordErrors;
  }

  // Nếu có lỗi, trả về lỗi validation
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors,
    });
  }

  next();
};

const validateChangePassword = (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;
  const errors = {};

  // Kiểm tra mật khẩu hiện tại
  if (!currentPassword) {
    errors.currentPassword = ["Vui lòng nhập mật khẩu hiện tại"];
  }

  // Kiểm tra mật khẩu mới và xác nhận
  if (newPassword !== confirmPassword) {
    errors.confirmPassword = ["Mật khẩu mới và xác nhận mật khẩu không khớp"];
  }

  // Kiểm tra mật khẩu mới bằng hàm tiện ích
  const passwordErrors = checkPasswordRequirements(newPassword);
  if (passwordErrors.length > 0) {
    errors.newPassword = passwordErrors;
  }

  // Nếu có lỗi, trả về lỗi validation
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ",
      errors,
    });
  }

  next();
};

module.exports = {
  validatePassword,
  validateRegisterInput,
  validateResetPassword,
  validateChangePassword,
};
