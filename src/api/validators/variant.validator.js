const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

const checkDuplicateSizes = (sizes) => {
  if (!sizes || !Array.isArray(sizes)) return true;

  const sizeIds = [];
  for (const item of sizes) {
    if (item && item.size) {
      sizeIds.push(String(item.size));
    }
  }

  const uniqueIds = new Set(sizeIds);
  if (uniqueIds.size !== sizeIds.length) {
    throw new ApiError(
      400,
      "Mỗi kích thước chỉ được xuất hiện một lần trong biến thể"
    );
  }

  return true;
};

const variantValidator = {
  // Kiểm tra ID biến thể
  validateVariantId: [
    param("id")
      .notEmpty()
      .withMessage("ID biến thể không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID biến thể không hợp lệ");
        }
        return true;
      }),
  ],

  // Kiểm tra dữ liệu tạo biến thể mới
  validateVariantData: [
    body("product")
      .notEmpty()
      .withMessage("ID sản phẩm không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID sản phẩm không hợp lệ");
        }
        return true;
      }),

    body("color")
      .notEmpty()
      .withMessage("ID màu sắc không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID màu sắc không hợp lệ");
        }
        return true;
      }),

    body("price")
      .notEmpty()
      .withMessage("Giá bán không được để trống")
      .isFloat({ min: 0 })
      .withMessage("Giá bán phải là số dương"),

    body("costPrice")
      .notEmpty()
      .withMessage("Giá gốc không được để trống")
      .isFloat({ min: 0 })
      .withMessage("Giá gốc phải là số dương")
      .custom((value, { req }) => {
        if (parseFloat(value) > parseFloat(req.body.price)) {
          throw new ApiError(400, "Giá gốc không được lớn hơn giá bán");
        }
        return true;
      }),

    body("percentDiscount")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Phần trăm giảm giá phải từ 0 đến 100"),

    body("gender")
      .optional()
      .isIn(["male", "female"])
      .withMessage("Giới tính phải là 'male' hoặc 'female'"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái active phải là boolean"),

    body("sizes")
      .isArray({ min: 1 })
      .withMessage("Phải có ít nhất một kích thước"),

    body("sizes.*.size")
      .notEmpty()
      .withMessage("ID kích thước không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID kích thước không hợp lệ");
        }
        return true;
      }),

    body("sizes.*.quantity")
      .isInt({ min: 0 })
      .withMessage("Số lượng phải là số nguyên không âm"),

    // Kiểm tra trùng lặp size trong biến thể
    body("sizes").custom(checkDuplicateSizes),
  ],

  // Kiểm tra dữ liệu cập nhật biến thể
  validateUpdateVariant: [
    param("id")
      .notEmpty()
      .withMessage("ID biến thể không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID biến thể không hợp lệ");
        }
        return true;
      }),

    body("color")
      .optional()
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID màu sắc không hợp lệ");
        }
        return true;
      }),

    body("price")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Giá bán phải là số dương"),

    body("costPrice")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Giá gốc phải là số dương")
      .custom((value, { req }) => {
        if (
          req.body.price !== undefined &&
          parseFloat(value) > parseFloat(req.body.price)
        ) {
          throw new ApiError(400, "Giá gốc không được lớn hơn giá bán");
        }
        return true;
      }),

    body("percentDiscount")
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage("Phần trăm giảm giá phải từ 0 đến 100"),

    body("gender")
      .optional()
      .isIn(["male", "female"])
      .withMessage("Giới tính phải là 'male' hoặc 'female'"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái active phải là true hoặc false"),

    body("sizes")
      .optional()
      .isArray({ min: 1 })
      .withMessage("Phải có ít nhất một kích thước"),

    body("sizes.*.size")
      .optional()
      .notEmpty()
      .withMessage("ID kích thước không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID kích thước không hợp lệ");
        }
        return true;
      }),

    body("sizes.*.quantity")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Số lượng phải là số nguyên không âm"),

    // Kiểm tra trùng lặp size trong cập nhật biến thể
    body("sizes").custom(checkDuplicateSizes),
  ],

  // Kiểm tra query lấy danh sách biến thể
  validateVariantQuery: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Trang phải là số nguyên dương"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Giới hạn phải là số nguyên từ 1-100"),

    query("productId")
      .optional()
      .custom((value) => {
        if (value && !mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID sản phẩm không hợp lệ");
        }
        return true;
      }),

    query("color")
      .optional()
      .custom((value) => {
        if (value && !mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID màu sắc không hợp lệ");
        }
        return true;
      }),

    query("gender")
      .optional()
      .isIn(["male", "female"])
      .withMessage("Giới tính phải là 'male' hoặc 'female'"),

    // === Validator cho giá nhập (costPrice) ===
    query("costPriceMin")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Giá nhập tối thiểu phải là số nguyên không âm"),

    query("costPriceMax")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Giá nhập tối đa phải là số nguyên không âm")
      .custom((value, { req }) => {
        if (
          req.query.costPriceMin &&
          Number(value) < Number(req.query.costPriceMin)
        ) {
          throw new ApiError(
            400,
            "Giá nhập tối đa phải lớn hơn hoặc bằng giá nhập tối thiểu"
          );
        }
        return true;
      }),

    // === Validator cho giá bán gốc (price) ===
    query("priceMin")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Giá bán gốc tối thiểu phải là số nguyên không âm"),

    query("priceMax")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Giá bán gốc tối đa phải là số nguyên không âm")
      .custom((value, { req }) => {
        if (req.query.priceMin && Number(value) < Number(req.query.priceMin)) {
          throw new ApiError(
            400,
            "Giá bán gốc tối đa phải lớn hơn hoặc bằng giá bán gốc tối thiểu"
          );
        }
        return true;
      }),

    // === Validator cho giá bán cuối (priceFinal) ===
    query("finalPriceMin")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Giá cuối tối thiểu phải là số nguyên không âm"),

    query("finalPriceMax")
      .optional()
      .isInt({ min: 0 })
      .withMessage("Giá cuối tối đa phải là số nguyên không âm")
      .custom((value, { req }) => {
        if (
          req.query.finalPriceMin &&
          Number(value) < Number(req.query.finalPriceMin)
        ) {
          throw new ApiError(
            400,
            "Giá cuối tối đa phải lớn hơn hoặc bằng giá cuối tối thiểu"
          );
        }
        return true;
      }),

    query("isActive")
      .optional()
      .isIn(["true", "false"])
      .withMessage("Trạng thái active không hợp lệ"),

    query("sort")
      .optional()
      .isString()
      .withMessage("Chuỗi sắp xếp phải là chuỗi")
      .custom((value) => {
        try {
          JSON.parse(value);
          return true;
        } catch (error) {
          throw new ApiError(400, "Chuỗi sắp xếp không hợp lệ");
        }
      }),
  ],

  // Kiểm tra dữ liệu cập nhật tồn kho
  validateInventoryUpdate: [
    param("id")
      .notEmpty()
      .withMessage("ID biến thể không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID biến thể không hợp lệ");
        }
        return true;
      }),

    body("sizes")
      .isArray()
      .withMessage("Dữ liệu phải là một mảng các kích thước"),

    body("sizes.*.sizeId")
      .notEmpty()
      .withMessage("ID kích thước không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID kích thước không hợp lệ");
        }
        return true;
      }),

    body("sizes.*.quantity")
      .isInt({ min: 0 })
      .withMessage("Số lượng phải là số nguyên không âm"),

    // Kiểm tra trùng lặp sizeId trong cập nhật tồn kho
    body("sizes").custom((sizes) => {
      if (!sizes || !Array.isArray(sizes)) return true;

      const sizeIds = [];
      for (const item of sizes) {
        if (item && item.sizeId) {
          sizeIds.push(String(item.sizeId));
        }
      }

      const uniqueIds = new Set(sizeIds);
      if (uniqueIds.size !== sizeIds.length) {
        throw new ApiError(
          400,
          "Mỗi kích thước chỉ được xuất hiện một lần trong cập nhật tồn kho"
        );
      }

      return true;
    }),
  ],

  // Kiểm tra trạng thái active
  validateStatusUpdate: [
    param("id")
      .notEmpty()
      .withMessage("ID biến thể không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID biến thể không hợp lệ");
        }
        return true;
      }),

    body("isActive")
      .notEmpty()
      .withMessage("Trạng thái active không được để trống")
      .isBoolean()
      .withMessage("Trạng thái active phải là true hoặc false"),
  ],
};

module.exports = variantValidator;
