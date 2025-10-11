const { param, query } = require("express-validator");
const validate = require("@utils/validatehelper");

const publicTagValidator = {
  /**
   * Validation cho lấy danh sách tags (public)
   */
  getAllTags: validate([
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Trang phải là số nguyên dương"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit phải từ 1 đến 100"),

    query("name")
      .optional()
      .trim()
      .isLength({ min: 1 })
      .withMessage("Tên tìm kiếm không được để trống"),

    query("type")
      .optional()
      .isIn(["MATERIAL", "USECASE", "CUSTOM"])
      .withMessage("Type phải là MATERIAL, USECASE hoặc CUSTOM")
      .toUpperCase(),

    query("sort")
      .optional()
      .isIn([
        "created_at_asc",
        "created_at_desc",
        "name_asc",
        "name_desc",
        "type_asc",
        "type_desc",
      ])
      .withMessage("Sort không hợp lệ"),
  ]),

  /**
   * Validation cho lấy tags theo type
   */
  getTagsByType: validate([
    param("type")
      .notEmpty()
      .withMessage("Type không được để trống")
      .isIn(["MATERIAL", "USECASE", "CUSTOM"])
      .withMessage("Type phải là MATERIAL, USECASE hoặc CUSTOM")
      .toUpperCase(),

    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Trang phải là số nguyên dương"),

    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit phải từ 1 đến 100"),
  ]),

  /**
   * Validation cho lấy tag theo ID
   */
  getTagById: validate([
    param("id").isMongoId().withMessage("ID tag không hợp lệ"),
  ]),
};

module.exports = publicTagValidator;
