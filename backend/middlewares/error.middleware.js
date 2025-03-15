// Middleware xử lý lỗi chung
exports.errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Log lỗi ra console trong môi trường development
  if (process.env.NODE_ENV === "development") {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? null : err.stack,
  });
};

// // middleware/errorMiddleware.js
// const errorHandler = (err, req, res, next) => {
//   let error = { ...err };
//   error.message = err.message;

//   // Log lỗi
//   console.error(err);

//   // MongoDB bad ObjectId
//   if (err.name === "CastError") {
//     const message = "Không tìm thấy tài nguyên";
//     error = new ErrorResponse(message, 404);
//   }

//   // MongoDB duplicate key
//   if (err.code === 11000) {
//     const message = "Dữ liệu đã tồn tại";
//     error = new ErrorResponse(message, 400);
//   }

//   // MongoDB validation error
//   if (err.name === "ValidationError") {
//     const message = Object.values(err.errors).map((val) => val.message);
//     error = new ErrorResponse(message, 400);
//   }

//   res.status(error.statusCode || 500).json({
//     success: false,
//     message: error.message || "Lỗi server",
//   });
// };

module.exports = errorHandler;
