const { body, param, query } = require("express-validator");
const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

const useCaseValidator = {
  validateGetUseCases: [
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Trang phải là số nguyên lớn hơn 0"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Giới hạn phải từ 1-100"),
    query("name").optional().isString().withMessage("Tên phải là chuỗi"),
    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái phải là boolean"),
    query("sort")
      .optional()
      .isString()
      .withMessage("Tham số sắp xếp phải là chuỗi"),
  ],

  validateUseCaseId: [
    param("id")
      .notEmpty()
      .withMessage("ID nhu cầu sử dụng không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID nhu cầu sử dụng không hợp lệ");
        }
        return true;
      }),
  ],

  validateCreateUseCase: [
    body("name")
      .notEmpty()
      .withMessage("Tên nhu cầu sử dụng không được để trống")
      .isString()
      .withMessage("Tên nhu cầu sử dụng phải là chuỗi")
      .isLength({ min: 2, max: 50 })
      .withMessage("Tên nhu cầu sử dụng phải có từ 2-50 ký tự")
      .trim(),

    body("description")
      .optional()
      .isString()
      .withMessage("Mô tả phải là chuỗi")
      .isLength({ max: 500 })
      .withMessage("Mô tả không được vượt quá 500 ký tự")
      .trim(),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái phải là boolean"),
  ],

  validateUpdateUseCase: [
    param("id")
      .notEmpty()
      .withMessage("ID nhu cầu sử dụng không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID nhu cầu sử dụng không hợp lệ");
        }
        return true;
      }),

    body("name")
      .optional()
      .isString()
      .withMessage("Tên nhu cầu sử dụng phải là chuỗi")
      .isLength({ min: 2, max: 50 })
      .withMessage("Tên nhu cầu sử dụng phải có từ 2-50 ký tự")
      .trim(),

    body("description")
      .optional()
      .isString()
      .withMessage("Mô tả phải là chuỗi")
      .isLength({ max: 500 })
      .withMessage("Mô tả không được vượt quá 500 ký tự")
      .trim(),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("Trạng thái phải là boolean"),
  ],

  validateStatusUpdate: [
    param("id")
      .notEmpty()
      .withMessage("ID nhu cầu sử dụng không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID nhu cầu sử dụng không hợp lệ");
        }
        return true;
      }),

    body("isActive")
      .exists()
      .withMessage("Trạng thái không được để trống")
      .isBoolean()
      .withMessage("Trạng thái phải là boolean"),
  ],
};

module.exports = useCaseValidator;
