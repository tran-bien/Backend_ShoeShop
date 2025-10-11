const express = require("express");
const router = express.Router();
const tagController = require("@controllers/public/tag.controller");
const tagValidator = require("@validators/public/tag.validator");

/**
 * @route   GET /api/v1/tags
 * @desc    Lấy tất cả tags đang active
 * @access  Public
 */
router.get("/", tagValidator.getAllTags, tagController.getAllTags);

/**
 * @route   GET /api/v1/tags/type/:type
 * @desc    Lấy tags theo type (MATERIAL/USECASE/CUSTOM)
 * @access  Public
 */
router.get(
  "/type/:type",
  tagValidator.getTagsByType,
  tagController.getTagsByType
);

/**
 * @route   GET /api/v1/tags/:id
 * @desc    Lấy chi tiết tag theo ID
 * @access  Public
 */
router.get("/:id", tagValidator.getTagById, tagController.getTagById);

module.exports = router;
