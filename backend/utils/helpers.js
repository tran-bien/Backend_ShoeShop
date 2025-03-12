/**
 * Tạo mã đơn hàng ngẫu nhiên
 * Format: OD-[YEAR][MONTH][DAY]-[RANDOM_STRING]
 * @returns {string} Mã đơn hàng
 */
exports.generateOrderCode = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");

  // Tạo chuỗi ngẫu nhiên 6 ký tự
  const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `OD-${year}${month}${day}-${randomString}`;
};

/**
 * Định dạng số tiền VND
 * @param {number} amount - Số tiền cần định dạng
 * @returns {string} Chuỗi định dạng tiền VND
 */
exports.formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

/**
 * Cắt ngắn chuỗi và thêm dấu '...' nếu vượt quá độ dài
 * @param {string} str - Chuỗi cần cắt ngắn
 * @param {number} maxLength - Độ dài tối đa
 * @returns {string} Chuỗi đã cắt ngắn
 */
exports.truncateString = (str, maxLength = 50) => {
  if (!str) return "";
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + "...";
};

/**
 * Kiểm tra địa chỉ email hợp lệ
 * @param {string} email - Địa chỉ email cần kiểm tra
 * @returns {boolean} True nếu email hợp lệ
 */
exports.isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Kiểm tra số điện thoại hợp lệ (Việt Nam)
 * @param {string} phone - Số điện thoại cần kiểm tra
 * @returns {boolean} True nếu số điện thoại hợp lệ
 */
exports.isValidPhoneNumber = (phone) => {
  const phoneRegex = /^(0|\+84)(\d{9,10})$/;
  return phoneRegex.test(phone);
};
