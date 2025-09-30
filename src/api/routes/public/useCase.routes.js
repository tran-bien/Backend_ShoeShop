const express = require("express");
const useCaseController = require("@controllers/admin/useCase.controller");
const useCaseValidator = require("@validators/useCase.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/v1/use-cases
 * @desc    Lấy tất cả nhu cầu sử dụng đang active và chưa xóa
 * @access  Public
 */
router.get("/", useCaseController.getPublicUseCases);

/**
 * @route   GET /api/v1/use-cases/:id
 * @desc    Lấy chi tiết nhu cầu sử dụng theo ID
 * @access  Public
 */
router.get(
  "/:id",
  validate(useCaseValidator.validateUseCaseId),
  useCaseController.getUseCaseById
);

module.exports = router;
