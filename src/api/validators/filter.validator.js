const { param, query } = require("express-validator");
const mongoose = require("mongoose");

const filterValidator = {
  // Kiểm tra ID sản phẩm
  validateProductId: [
    param("id")
      .notEmpty()
      .withMessage("ID sản phẩm không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new Error("ID sản phẩm không hợp lệ");
        }
        return true;
      }),
  ],

  // Kiểm tra query gợi ý
  validateSuggestionQuery: [
    query("keyword")
      .notEmpty()
      .withMessage("Từ khóa tìm kiếm không được để trống")
      .isString()
      .withMessage("Từ khóa tìm kiếm phải là chuỗi")
      .isLength({ min: 2 })
      .withMessage("Từ khóa tìm kiếm phải có ít nhất 2 ký tự"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 20 })
      .withMessage("Giới hạn phải là số nguyên từ 1-20"),
  ],
};

module.exports = filterValidator;
