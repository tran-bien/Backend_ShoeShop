const express = require("express");
const router = express.Router();
const filterController = require("@controllers/public/filter.controller");
const filterValidator = require("@validators/filter.validator");
const validate = require("@utils/validatehelper");

/**
 * @route   GET /api/filters/attributes
 * @desc    Lấy thuộc tính lọc cho sản phẩm
 * @access  Public
 */
router.get("/attributes", filterController.getFilterAttributes);

/**
 * @route   GET /api/filters/products/:id/attributes
 * @desc    Lấy thuộc tính của sản phẩm
 * @access  Public
 */
router.get(
  "/products/:id/attributes",
  validate(filterValidator.validateProductId),
  filterController.getProductAttributes
);

/**
 * @route   GET /api/filters/suggestions
 * @desc    Lấy gợi ý tìm kiếm
 * @access  Public
 */
router.get("/suggestions", filterController.getSuggestions);

module.exports = router;
