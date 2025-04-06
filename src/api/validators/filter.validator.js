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
          const error = new Error("ID sản phẩm không hợp lệ");
          error.statusCode = 400; // Bad Request
          throw error;
        }
        return true;
      }),
  ],
};

module.exports = filterValidator;
