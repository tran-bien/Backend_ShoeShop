const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("@config/cloudinary");
const ApiError = require("@utils/ApiError");
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
      new ApiError(
        400,
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
const createMultiUploadMiddleware = (folderPath, fieldName, maxCount = 10) => {
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
  uploadProductImages: createMultiUploadMiddleware(
    "products/images",
    "images",
    10
  ),
  uploadVariantImages: createMultiUploadMiddleware(
    "products/variants",
    "images",
    10
  ),
  uploadBrandLogo: createSingleUploadMiddleware("brands", "logo"),
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
        throw new ApiError(
          400,
          `Kích thước file không được vượt quá ${
            MAX_FILE_SIZE / (1024 * 1024)
          }MB`
        );
      }
      if (err.code === "LIMIT_FILE_COUNT") {
        throw new ApiError(400, "Số lượng file vượt quá giới hạn cho phép");
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        throw new ApiError(
          400,
          "Field không hợp lệ hoặc số lượng file vượt quá giới hạn"
        );
      }
      throw new ApiError(400, `Lỗi upload: ${err.message}`);
    }

    if (err) {
      throw new ApiError(400, err.message);
    }

    next();
  },

  /**
   * Middleware xử lý upload avatar
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
   * Middleware xử lý upload product images
   */
  handleProductImagesUpload: (req, res, next) => {
    uploadMiddleware.uploadProductImages(req, res, (err) => {
      if (err) {
        return uploadMiddleware.handleUploadError(err, req, res, next);
      }
      next();
    });
  },

  /**
   * Middleware xử lý upload variant images
   */
  handleVariantImagesUpload: (req, res, next) => {
    uploadMiddleware.uploadVariantImages(req, res, (err) => {
      if (err) {
        return uploadMiddleware.handleUploadError(err, req, res, next);
      }
      next();
    });
  },

  /**
   * Middleware xử lý upload brand logo
   */
  handleBrandLogoUpload: (req, res, next) => {
    uploadMiddleware.uploadBrandLogo(req, res, (err) => {
      if (err) {
        return uploadMiddleware.handleUploadError(err, req, res, next);
      }
      next();
    });
  },

};

module.exports = uploadMiddleware;
