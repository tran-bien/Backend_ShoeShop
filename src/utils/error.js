/**
 * Hàm tạo đối tượng lỗi tùy chỉnh với thông tin mở rộng
 * @param {number} statusCode - Mã trạng thái HTTP
 * @param {string} message - Thông báo lỗi
 * @param {Object} extras - Thông tin bổ sung (tùy chọn)
 * @returns {Error} Đối tượng lỗi đã được tăng cường
 */
exports.createError = (statusCode, message, extras = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;

  // Thêm các thuộc tính bổ sung vào đối tượng lỗi
  if (extras && typeof extras === "object") {
    Object.keys(extras).forEach((key) => {
      error[key] = extras[key];
    });
  }

  return error;
};
