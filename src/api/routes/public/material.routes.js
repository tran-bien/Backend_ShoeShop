const express = require("express");
const materialController = require("@controllers/admin/material.controller");
const materialValidator = require("@validators/material.validator");
const validate = require("@utils/validatehelper");

const router = express.Router();

/**
 * @route   GET /api/v1/materials
 * @desc    Lấy tất cả vật liệu đang active và chưa xóa
 * @access  Public
 */
router.get("/", materialController.getPublicMaterials);

/**
 * @route   GET /api/v1/materials/:id
 * @desc    Lấy chi tiết vật liệu theo ID
 * @access  Public
 */
router.get(
  "/:id",
  validate(materialValidator.validateMaterialId),
  materialController.getMaterialById
);

module.exports = router;
