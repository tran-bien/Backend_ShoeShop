const asyncHandler = require("express-async-handler");
const {
  uploadFileOneOrMultiple,
  deleteFileOneOrMultiple,
} = require("@services/cloudinary.service");

// Controller upload chung (một hoặc nhiều file)
exports.uploadFileOneOrMultiple = asyncHandler(async (req, res) => {
  // req.files là mảng các file được multer xử lý, ngay cả khi chỉ có 1 file
  const filePaths = req.files.map((file) => file.path);
  const results = await uploadFileOneOrMultiple(filePaths, "uploads");

  // Ví dụ: nếu chỉ có 1 file, trả về kết quả bằng key 'file', ngược lại 'files'
  if (results.length === 1) {
    res.json({
      success: true,
      message: "Tải lên thành công",
      file: results[0],
    });
  } else {
    res.json({
      success: true,
      message: "Tải lên thành công",
      files: results,
    });
  }
});

// Controller xóa file (1 hoặc nhiều file)
exports.deleteFileOneOrMultiple = asyncHandler(async (req, res) => {
  // Nếu có req.body.publicIds thì dùng luôn, nếu có req.body.publicId thì chuyển thành mảng
  let publicIds = req.body.publicIds;
  if (!publicIds || (Array.isArray(publicIds) && publicIds.length === 0)) {
    if (req.body.publicId) {
      publicIds = [req.body.publicId];
    }
  }
  if (!Array.isArray(publicIds) || publicIds.length === 0) {
    res.status(400);
    throw new Error("Vui lòng cung cấp ít nhất một publicId để xóa");
  }
  const results = await deleteFileOneOrMultiple(publicIds);
  res.json({
    success: true,
    message: "Xóa file thành công",
    results,
  });
});
