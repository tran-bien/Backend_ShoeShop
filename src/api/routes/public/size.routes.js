const express = require("express");
const router = express.Router();
const sizeController = require("@controllers/public/size.controller");
const sizeValidator = require("@validators/size.validator");
const validate = require("@utils/validatehelper");

/**
 * @route   GET /api/sizes
 * @desc    Lấy danh sách tất cả kích thước
 * @access  Public
 */
router.get(
  "/",
  validate(sizeValidator.validateListQuery),
  sizeController.getAllSizes
);

/**
 * @route   GET /api/sizes/:id
 * @desc    Lấy thông tin chi tiết kích thước theo ID
 * @access  Public
 */
router.get(
  "/:id",
  validate(sizeValidator.validateSizeId),
  sizeController.getSizeById
);

module.exports = router;
