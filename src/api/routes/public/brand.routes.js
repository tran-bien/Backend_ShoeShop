const express = require("express");
const brandController = require("@controllers/public/brand.controller");
const brandValidator = require("@validators/brand.validator");
const { validateRequest } = require("@middlewares/validateRequest");

const router = express.Router();

// Gom nhóm validators + validateRequest để code ngắn gọn
const validate = (validators) => [
  ...(Array.isArray(validators) ? validators : [validators]),
  validateRequest,
];

/**
 * @route   GET /api/brands
 * @desc    Lấy tất cả thương hiệu đang active và chưa xóa
 * @access  Public
 */
router.get("/", validate(brandValidator.validatePublicBrandQuery));

/**
 * @route   GET /api/brands/slug/:slug
 * @desc    Lấy chi tiết thương hiệu theo slug
 * @access  Public
 */
router.get(
  "/slug/:slug",
  validate(brandValidator.validateBrandSlug),
  brandController.getBrandBySlug
);

/**
 * @route   GET /api/brands/:id
 * @desc    Lấy chi tiết thương hiệu theo ID
 * @access  Public
 */
router.get(
  "/:id",
  validate(brandValidator.validateBrandId),
  brandController.getBrandById
);

module.exports = router;
