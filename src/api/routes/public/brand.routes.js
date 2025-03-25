const express = require("express");
const brandController = require("@controllers/public/brand.controller");
const brandValidator = require("@validators/brand.validator");
const { validateRequest } = require("@middlewares/validateRequest");

const router = express.Router();

/**
 * @route   GET /api/brands
 * @desc    Lấy tất cả thương hiệu đang active và chưa xóa
 * @access  Public
 */
router.get(
  "/",
  brandValidator.validateBrandQuery,
  validateRequest,
  brandController.getAllBrands
);

/**
 * @route   GET /api/brands/slug/:slug
 * @desc    Lấy chi tiết thương hiệu theo slug
 * @access  Public
 */
router.get("/slug/:slug", brandController.getBrandBySlug);

/**
 * @route   GET /api/brands/:id
 * @desc    Lấy chi tiết thương hiệu theo ID
 * @access  Public
 */
router.get(
  "/:id",
  brandValidator.validateBrandId,
  validateRequest,
  brandController.getBrandById
);

module.exports = router;
