const express = require("express");
const router = express.Router();
const colorController = require("@controllers/public/color.controller");
const colorValidator = require("@validators/color.validator");
const validate = require("@utils/validatehelper");

/**
 * @route   GET /api/colors
 * @desc    Lấy danh sách tất cả màu sắc
 * @access  Public
 */
router.get(
  "/",
  validate(colorValidator.validateListQuery),
  colorController.getAllColors
);

/**
 * @route   GET /api/colors/:id
 * @desc    Lấy thông tin chi tiết màu sắc theo ID
 * @access  Public
 */
router.get(
  "/:id",
  validate(colorValidator.validateColorId),
  colorController.getColorById
);

module.exports = router;
