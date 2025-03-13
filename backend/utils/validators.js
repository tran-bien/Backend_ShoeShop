// Logic cho kiểm tra email
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

// Logic cho kiểm tra số điện thoại
const isValidPhoneNumber = (phone) => {
  const re = /^\d{10}$/; // Ví dụ: kiểm tra số điện thoại 10 chữ số
  return re.test(String(phone));
};

// Logic cho kiểm tra mật khẩu
const checkPasswordRequirements = (password) => {
  // Kiểm tra mật khẩu có ít nhất 8 ký tự, 1 chữ cái và 1 số
  const re = /^(?=.*[a-zA-Z])(?=.*\d)[A-Za-z\d]{8,}$/;
  return re.test(password);
};

module.exports = {
  isValidEmail,
  isValidPhoneNumber,
  checkPasswordRequirements,
};
