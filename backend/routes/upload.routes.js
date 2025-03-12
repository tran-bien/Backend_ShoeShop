const express = require("express");
const { protect, authorize } = require("../middlewares/auth.middleware");
const {
  uploadSingle,
  uploadMultiple,
  handleUploadError,
} = require("../middlewares/upload.middleware");
const { uploadImage, uploadMultipleImages } = require("../utils/cloudinary");
const router = express.Router();

// Middleware bảo vệ route
router.use(protect);

// Upload một file ảnh
router.post("/single", uploadSingle, handleUploadError, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng chọn file để tải lên",
      });
    }

    const result = await uploadImage(req.file.path, "uploads");

    res.json({
      success: true,
      message: "Tải lên thành công",
      file: {
        url: result.url,
        publicId: result.public_id,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Không thể tải file lên. Vui lòng thử lại!",
    });
  }
});

// Upload nhiều file ảnh
router.post(
  "/multiple",
  uploadMultiple,
  handleUploadError,
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Vui lòng chọn ít nhất một file để tải lên",
        });
      }

      const results = await uploadMultipleImages(
        req.files.map((file) => file.path),
        "uploads"
      );

      res.json({
        success: true,
        message: "Tải lên thành công",
        files: results.map((result) => ({
          url: result.url,
          publicId: result.public_id,
        })),
      });
    } catch (error) {
      console.error("Upload multiple error:", error);
      res.status(500).json({
        success: false,
        message: "Không thể tải các file lên. Vui lòng thử lại!",
      });
    }
  }
);

module.exports = router;
