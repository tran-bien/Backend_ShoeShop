// Định nghĩa middleware xử lý lỗi chung
const errorHandler = (err, req, res, next) => {
  // Ưu tiên lấy statusCode từ đối tượng lỗi, nếu không có thì mới sử dụng statusCode từ response
  // Nếu res.statusCode là 200 (mã mặc định) thì sử dụng 500
  const statusCode = err.statusCode
    ? err.statusCode
    : res.statusCode === 200
    ? 500
    : res.statusCode;

  // In stack lỗi ra console khi đang ở môi trường development
  if (process.env.NODE_ENV === "development") {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

module.exports = errorHandler;
