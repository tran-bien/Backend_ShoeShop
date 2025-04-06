const { body, param } = require("express-validator");
const mongoose = require("mongoose");

/**
 * Kiểm tra ID có phải là MongoDB ObjectId hợp lệ không
 */
const isValidObjectId = (value) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    const error = new Error("ID không hợp lệ");
    error.statusCode = 400; // Bad Request
    throw error;
  }
  return true;
};

/**
 * Kiểm tra mảng ID có đúng định dạng MongoDB ObjectId không
 */
const areValidObjectIds = (value) => {
  if (!Array.isArray(value)) {
    const error = new Error("Phải là một mảng các ID");
    error.statusCode = 400; // Bad Request
    throw error;
  }

  if (!value.every((id) => mongoose.Types.ObjectId.isValid(id))) {
    const error = new Error("Có ID không hợp lệ trong danh sách");
    error.statusCode = 400; // Bad Request
    throw error;
  }

  return true;
};

// Validator chi tiết theo từng thao tác
const uploadValidator = {
  /**
   * Validator cho brandId
   */
  validateBrandId: [
    param("brandId")
      .custom(isValidObjectId)
      .withMessage("ID thương hiệu không hợp lệ"),
  ],

  /**
   * Validator cho productId
   */
  validateProductId: [
    param("productId")
      .custom(isValidObjectId)
      .withMessage("ID sản phẩm không hợp lệ"),
  ],

  /**
   * Validator cho variantId
   */
  validateVariantId: [
    param("variantId")
      .custom(isValidObjectId)
      .withMessage("ID biến thể không hợp lệ"),
  ],

  /**
   * Validator cho xóa ảnh
   */
  validateImageIds: [
    body("imageIds")
      .isArray({ min: 1 })
      .withMessage("Vui lòng cung cấp ít nhất một ID ảnh")
      .custom(areValidObjectIds)
      .withMessage("Có ID ảnh không hợp lệ trong danh sách"),
  ],

  /**
   * Validator cho sắp xếp ảnh
   */
  validateImageOrders: [
    // Kiểm tra imageOrders tồn tại và là mảng
    body("imageOrders")
      .notEmpty()
      .withMessage("Vui lòng cung cấp thông tin sắp xếp ảnh")
      .isArray()
      .withMessage("Vui lòng cung cấp ít nhất một thứ tự ảnh"),

    // Kiểm tra từng phần tử trong mảng
    body("imageOrders.*.displayOrder")
      .isInt({ min: 0 })
      .withMessage("Thứ tự hiển thị phải là số nguyên không âm"),

    body("imageOrders.*._id")
      .custom(isValidObjectId)
      .withMessage("ID ảnh không hợp lệ"),
  ],

  /**
   * Validator cho đặt ảnh chính
   */
  validateMainImage: [
    body("imageId")
      .notEmpty()
      .withMessage("Vui lòng cung cấp ID ảnh")
      .custom(isValidObjectId)
      .withMessage("ID ảnh không hợp lệ"),
  ],

  /**
   * Validator cho kiểm tra tệp đã được upload (single)
   */
  validateSingleFileExists: [
    body().custom((_, { req }) => {
      if (!req.file) {
        const error = new Error("Không có file nào được tải lên");
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator cho kiểm tra tệp đã được upload (multi)
   */
  validateMultipleFilesExist: [
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) {
        const error = new Error("Không có file nào được tải lên");
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator cho xóa ảnh từ Cloudinary (hỗ trợ publicId hoặc publicIds)
   */
  validateCloudinaryDelete: [
    // Nếu người dùng cung cấp publicIds thì nó phải là mảng
    body("publicIds")
      .optional()
      .isArray()
      .withMessage("Dữ liệu các mã file cần xóa không đúng định dạng"),

    // Nếu có publicIds, mỗi phần tử phải là chuỗi không rỗng
    body("publicIds.*")
      .optional()
      .isString()
      .withMessage("Mỗi mã file cần xóa phải là văn bản hợp lệ")
      .notEmpty()
      .withMessage("Mã file không được để trống"),

    // Nếu cung cấp publicId thì phải là chuỗi không rỗng
    body("publicId")
      .optional()
      .isString()
      .withMessage("Mã file cần xóa phải là văn bản hợp lệ")
      .notEmpty()
      .withMessage("Mã file không được để trống"),

    // Custom validator: phải có ít nhất một trong số các trường (publicIds hoặc publicId)
    body().custom((_, { req }) => {
      if (
        (!req.body.publicIds || req.body.publicIds.length === 0) &&
        !req.body.publicId
      ) {
        const error = new Error(
          "Vui lòng cung cấp ít nhất một mã file cần xóa"
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator kiểm tra loại file ảnh (single)
   */
  validateImageFileType: [
    body().custom((_, { req }) => {
      if (!req.file) return true;

      const validMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      if (!validMimeTypes.includes(req.file.mimetype)) {
        const error = new Error(
          "Chỉ chấp nhận file hình ảnh (jpeg, png, gif, webp, svg)"
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator kiểm tra loại file ảnh (multiple)
   */
  validateMultipleImageFileTypes: [
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) return true;

      const validMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      const invalidFiles = req.files.filter(
        (file) => !validMimeTypes.includes(file.mimetype)
      );

      if (invalidFiles.length > 0) {
        const invalidNames = invalidFiles.map((f) => f.originalname).join(", ");
        const error = new Error(
          `Các file không hợp lệ: ${invalidNames}. Chỉ chấp nhận file hình ảnh (jpeg, png, gif, webp, svg)`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator kiểm tra kích thước file (single)
   */
  validateImageFileSize: [
    body().custom((_, { req }) => {
      if (!req.file) return true;

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        const error = new Error(
          `Kích thước file không được vượt quá 5MB. File hiện tại: ${(
            req.file.size /
            (1024 * 1024)
          ).toFixed(2)}MB`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator kiểm tra kích thước file (multiple)
   */
  validateMultipleImageFileSizes: [
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) return true;

      const maxSize = 5 * 1024 * 1024; // 5MB
      const oversizedFiles = req.files.filter((file) => file.size > maxSize);

      if (oversizedFiles.length > 0) {
        const oversizedDetails = oversizedFiles
          .map(
            (f) => `${f.originalname}: ${(f.size / (1024 * 1024)).toFixed(2)}MB`
          )
          .join(", ");
        const error = new Error(
          `Các file vượt quá kích thước cho phép (5MB): ${oversizedDetails}`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator giới hạn số lượng file
   */
  validateMaxFileCount: [
    body().custom((_, { req }) => {
      if (!req.files) return true;

      const maxFileCount = 10; // Số file tối đa cho phép
      if (req.files.length > maxFileCount) {
        const error = new Error(
          `Chỉ được phép tải lên tối đa ${maxFileCount} file. Bạn đang tải lên ${req.files.length} file.`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator kiểm tra tổng kích thước của tất cả các file
   */
  validateTotalFileSize: [
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) return true;

      const maxTotalSize = 20 * 1024 * 1024; // 20MB tổng
      const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);

      if (totalSize > maxTotalSize) {
        const error = new Error(
          `Tổng kích thước các file không được vượt quá 20MB. Hiện tại: ${(
            totalSize /
            (1024 * 1024)
          ).toFixed(2)}MB`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator cho tất cả điều kiện của một file duy nhất
   */
  validateSingleImage: [
    // Kiểm tra tồn tại
    body().custom((_, { req }) => {
      if (!req.file) {
        const error = new Error("Không có file nào được tải lên");
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),

    // Kiểm tra loại file
    body().custom((_, { req }) => {
      if (!req.file) return true;

      const validMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      if (!validMimeTypes.includes(req.file.mimetype)) {
        const error = new Error(
          "Chỉ chấp nhận file hình ảnh (jpeg, png, gif, webp, svg)"
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),

    // Kiểm tra kích thước
    body().custom((_, { req }) => {
      if (!req.file) return true;

      const maxSize = 5 * 1024 * 1024; // 5MB
      if (req.file.size > maxSize) {
        const error = new Error(
          `Kích thước file không được vượt quá 5MB. File hiện tại: ${(
            req.file.size /
            (1024 * 1024)
          ).toFixed(2)}MB`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],

  /**
   * Validator cho tất cả điều kiện của nhiều file
   */
  validateMultipleImages: [
    // Kiểm tra tồn tại
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) {
        const error = new Error("Không có file nào được tải lên");
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),

    // Kiểm tra số lượng
    body().custom((_, { req }) => {
      if (!req.files) return true;

      const maxFileCount = 10; // Số file tối đa cho phép
      if (req.files.length > maxFileCount) {
        const error = new Error(
          `Chỉ được phép tải lên tối đa ${maxFileCount} file. Bạn đang tải lên ${req.files.length} file.`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),

    // Kiểm tra loại file
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) return true;

      const validMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];
      const invalidFiles = req.files.filter(
        (file) => !validMimeTypes.includes(file.mimetype)
      );

      if (invalidFiles.length > 0) {
        const invalidNames = invalidFiles.map((f) => f.originalname).join(", ");
        const error = new Error(
          `Các file không hợp lệ: ${invalidNames}. Chỉ chấp nhận file hình ảnh (jpeg, png, gif, webp, svg)`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),

    // Kiểm tra kích thước từng file
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) return true;

      const maxSize = 5 * 1024 * 1024; // 5MB
      const oversizedFiles = req.files.filter((file) => file.size > maxSize);

      if (oversizedFiles.length > 0) {
        const oversizedDetails = oversizedFiles
          .map(
            (f) => `${f.originalname}: ${(f.size / (1024 * 1024)).toFixed(2)}MB`
          )
          .join(", ");
        const error = new Error(
          `Các file vượt quá kích thước cho phép (5MB): ${oversizedDetails}`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),

    // Kiểm tra tổng kích thước
    body().custom((_, { req }) => {
      if (!req.files || req.files.length === 0) return true;

      const maxTotalSize = 20 * 1024 * 1024; // 20MB tổng
      const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);

      if (totalSize > maxTotalSize) {
        const error = new Error(
          `Tổng kích thước các file không được vượt quá 20MB. Hiện tại: ${(
            totalSize /
            (1024 * 1024)
          ).toFixed(2)}MB`
        );
        error.statusCode = 400; // Bad Request
        throw error;
      }
      return true;
    }),
  ],
};

module.exports = uploadValidator;
