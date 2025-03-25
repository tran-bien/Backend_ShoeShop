const express = require("express");
const brandController = require("@controllers/public/brand.controller");
const {
  idValidator,
  slugValidator,
  listBrandsValidator,
} = require("@validators/brand.validator");
const { validate } = require("@validators/index");
const router = express.Router();

/**
 * @route   GET /api/brands
 * @desc    Lấy tất cả thương hiệu
 * @access  Public
 */
router.get("/", listBrandsValidator, validate, brandController.getAllBrands);

/**
 * @route   GET /api/brands/:id
 * @desc    Xem chi tiết thương hiệu
 * @access  Public
 */
router.get("/:id", idValidator, validate, brandController.getBrandById);

/**
 * @route   GET /api/brands/slug/:slug
 * @desc    Xem thương hiệu qua URL thân thiện
 * @access  Public
 */
router.get(
  "/slug/:slug",
  slugValidator,
  validate,
  brandController.getBrandBySlug
);

/**
 * @route   GET /api/brands/:id/products
 * @desc    Lấy sản phẩm thuộc thương hiệu
 * @access  Public
 */
router.get(
  "/:id/products",
  idValidator,
  validate,
  brandController.getProductsByBrand
);

module.exports = router;
