const express = require("express");
const { protect } = require("@middlewares/auth.middleware");
const {
  uploadFileOneOrMultiple,
  deleteFileOneOrMultiple,
} = require("@controllers/public/cloudinary.controller");
const {
  uploadFileOneOrMultipleValidation,
  deleteFileOneOrMultipleValidation,
} = require("@validators/upload.validator");
const router = express.Router();

// Import middleware của multer gồm uploadFiles và xử lý lỗi
const {
  uploadFiles,
  handleUploadError,
} = require("@middlewares/upload.middleware");

// Middleware bảo vệ route
router.use(protect);

// Route upload chung (cho 1 hoặc nhiều file)
// Thứ tự middleware:
// 1. uploadFiles: phân tích multipart, lưu file vào req.files
// 2. handleUploadError: bắt lỗi từ multer (nếu có)
// 3. uploadFileOneOrMultipleValidation: kiểm tra dữ liệu đầu vào (đảm bảo req.files tồn tại)
// 4. Controller uploadFileOneOrMultiple để upload lên Cloudinary
router.post(
  "/",
  uploadFiles,
  handleUploadError,
  uploadFileOneOrMultipleValidation,
  uploadFileOneOrMultiple
);

// Route xóa file: thay vì dùng param, nhận dữ liệu từ body (publicId hoặc publicIds)
router.delete("/", deleteFileOneOrMultipleValidation, deleteFileOneOrMultiple);

module.exports = router;
