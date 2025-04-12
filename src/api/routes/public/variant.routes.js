const express = require("express");
const router = express.Router();
const variantController = require("@controllers/public/variant.controller");
const variantValidator = require("@validators/variant.validator");
const validate = require("@utils/validatehelper");
const { param } = require("express-validator");
const mongoose = require("mongoose");
const ApiError = require("@utils/ApiError");

/**
 * @route   GET /api/variants/:id/inventory
 * @desc    Lấy tổng quan tồn kho của biến thể
 * @access  Public
 */
router.get(
  "/:id/inventory",
  validate(variantValidator.validateVariantId),
  variantController.getVariantInventory
);

/**
 * @route   GET /api/variants/product/:productId
 * @desc    Lấy biến thể theo sản phẩm, màu sắc và kích thước
 * @access  Public
 */
router.get(
  "/product/:productId",
  validate([
    param("productId")
      .notEmpty()
      .withMessage("ID sản phẩm không được để trống")
      .custom((value) => {
        if (!mongoose.Types.ObjectId.isValid(value)) {
          throw new ApiError(400, "ID sản phẩm không hợp lệ");
        }
        return true;
      }),
  ]),
  variantController.getVariantByCriteria
);

module.exports = router;
