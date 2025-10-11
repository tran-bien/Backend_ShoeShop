const { body, param, query } = require("express-validator");
const validate = require("@utils/validatehelper");

const tagValidator = {
  /**
   * Validation cho tạo tag mới
   */
  createTag: validate([
    body("name")
      .trim()
      .notEmpty()
      .withMessage("Tên tag không được để trống")
      .isLength({ max: 100 })
      .withMessage("Tên tag không được vượt quá 100 ký tự"),

    body("type")
      .optional()
      .isIn(["MATERIAL", "USECASE", "CUSTOM"])
      .withMessage("Type phải là MATERIAL, USECASE hoặc CUSTOM")
      .toUpperCase(),

    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Mô tả không được vượt quá 500 ký tự"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive phải là boolean"),
  ]),

  /**
   * Validation cho cập nhật tag
   */
  updateTag: validate([
    param("id").isMongoId().withMessage("ID tag không hợp lệ"),

    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Tên tag không được để trống")
      .isLength({ max: 100 })
      .withMessage("Tên tag không được vượt quá 100 ký tự"),

    body("type")
      .optional()
      .isIn(["MATERIAL", "USECASE", "CUSTOM"])
      .withMessage("Type phải là MATERIAL, USECASE hoặc CUSTOM")
      .toUpperCase(),

    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Mô tả không được vượt quá 500 ký tự"),

    body("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive phải là boolean"),
  ]),

  /**
   * Validation cho lấy danh sách tags
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

    query("isActive")
      .optional()
      .isBoolean()
      .withMessage("isActive phải là boolean"),

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
   * Validation cho lấy danh sách tags đã xóa
   */
  getDeletedTags: validate([
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
   * Validation cho lấy tag theo ID
   */
  getTagById: validate([
    param("id").isMongoId().withMessage("ID tag không hợp lệ"),
  ]),

  /**
   * Validation cho xóa tag
   */
  deleteTag: validate([
    param("id").isMongoId().withMessage("ID tag không hợp lệ"),
  ]),

  /**
   * Validation cho khôi phục tag
   */
  restoreTag: validate([
    param("id").isMongoId().withMessage("ID tag không hợp lệ"),
  ]),

  /**
   * Validation cho cập nhật trạng thái
   */
  updateTagStatus: validate([
    param("id").isMongoId().withMessage("ID tag không hợp lệ"),

    body("isActive")
      .notEmpty()
      .withMessage("isActive không được để trống")
      .isBoolean()
      .withMessage("isActive phải là boolean"),
  ]),
};

module.exports = tagValidator;
