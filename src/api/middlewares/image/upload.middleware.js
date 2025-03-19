const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require("path");
const cloudinary = require("@config/cloudinary");

// Danh sách các loại file ảnh được phép
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

// Kích thước file tối đa (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Tạo storage theo folder tùy chỉnh
 * @param {string} folder - Thư mục trên Cloudinary
 * @returns {CloudinaryStorage} - Đối tượng storage cho multer
 */
const createStorage = (folder) => {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder: folder,
      allowed_formats: ["jpg", "jpeg", "png", "webp"],
      transformation: [{ quality: "auto" }],
      public_id: (req, file) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const filename = file.originalname.split(".")[0].replace(/\s+/g, "-");
        return `${filename}-${uniqueSuffix}`;
      },
    },
  });
};

/**
 * Kiểm tra loại file
 * @param {Object} req - Request object
 * @param {Object} file - File object từ multer
 * @param {Function} cb - Callback function
 */
const fileFilter = (req, file, cb) => {
  if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Loại file không được hỗ trợ. Chỉ chấp nhận file JPEG, JPG, PNG, WEBP"
      ),
      false
    );
  }
};

/**
 * Tạo middleware upload cho nhiều ảnh
 * @param {String} folderPath - Đường dẫn thư mục trên Cloudinary
 * @param {String} fieldName - Tên field trong form-data
 * @param {Number} maxCount - Số lượng file tối đa
 * @returns {Function} - Middleware multer
 */
const createUploadMiddleware = (folderPath, fieldName, maxCount = 10) => {
  const storage = createStorage(folderPath);
  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
  }).array(fieldName, maxCount);
};

/**
 * Tạo middleware upload cho một ảnh
 * @param {String} folderPath - Đường dẫn thư mục trên Cloudinary
 * @param {String} fieldName - Tên field trong form-data
 * @returns {Function} - Middleware multer
 */
const createSingleUploadMiddleware = (folderPath, fieldName) => {
  const storage = createStorage(folderPath);
  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE },
    fileFilter,
  }).single(fieldName);
};

// Middleware upload cho từng entity
const uploadMiddleware = {
  // Các middleware upload cơ bản
  uploadProductImages: createUploadMiddleware("products/images", "images", 10),
  uploadVariantImages: createUploadMiddleware(
    "products/variants",
    "images",
    10
  ),
  uploadBrandLogo: createUploadMiddleware("brands", "logo", 1),
  uploadReviewImages: createUploadMiddleware("reviews", "images", 5),
  uploadAvatar: createSingleUploadMiddleware("users/avatars", "avatar"),

  /**
   * Middleware xử lý lỗi upload
   * @param {Error} err - Lỗi từ multer
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware
   */
  handleUploadError: (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          message: `Kích thước file không được vượt quá ${
            MAX_FILE_SIZE / (1024 * 1024)
          }MB`,
        });
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        return res.status(400).json({
          success: false,
          message: "Số lượng file vượt quá giới hạn cho phép",
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return res.status(400).json({
          success: false,
          message: "Field không hợp lệ hoặc số lượng file vượt quá giới hạn",
        });
      }
      return res.status(400).json({
        success: false,
        message: `Lỗi upload: ${err.message}`,
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    next();
  },

  /**
   * Middleware động để chọn middleware upload dựa vào loại model
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware
   */
  chooseUploadMiddlewareByModelType: (req, res, next) => {
    const modelType = req.params.modelType;
    let uploadMiddlewareFunc;

    switch (modelType) {
      case "product":
        uploadMiddlewareFunc = uploadMiddleware.uploadProductImages;
        break;
      case "variant":
        uploadMiddlewareFunc = uploadMiddleware.uploadVariantImages;
        break;
      case "brand":
        uploadMiddlewareFunc = uploadMiddleware.uploadBrandLogo;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: "Loại model không hợp lệ",
        });
    }

    uploadMiddlewareFunc(req, res, (err) => {
      if (err) {
        return uploadMiddleware.handleUploadError(err, req, res, next);
      }
      next();
    });
  },

  /**
   * Middleware xử lý upload avatar
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware
   */
  handleAvatarUpload: (req, res, next) => {
    uploadMiddleware.uploadAvatar(req, res, (err) => {
      if (err) {
        return uploadMiddleware.handleUploadError(err, req, res, next);
      }
      next();
    });
  },

  /**
   * Middleware xử lý upload ảnh review
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware
   */
  handleReviewImageUpload: (req, res, next) => {
    uploadMiddleware.uploadReviewImages(req, res, (err) => {
      if (err) {
        return uploadMiddleware.handleUploadError(err, req, res, next);
      }
      next();
    });
  },
};

module.exports = uploadMiddleware;
