const asyncHandler = require("express-async-handler");
const materialService = require("@services/material.service");

const materialController = {
  /**
   * @desc    Lấy danh sách chất liệu
   * @route   GET /api/v1/admin/materials
   * @access  Staff (read-only), Admin
   */
  getAllMaterials: asyncHandler(async (req, res) => {
    const result = await materialService.getAllMaterials(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy danh sách chất liệu đã xóa
   * @route   GET /api/v1/admin/materials/deleted
   * @access  Staff (read-only), Admin
   */
  getDeletedMaterials: asyncHandler(async (req, res) => {
    const result = await materialService.getDeletedMaterials(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy chi tiết chất liệu
   * @route   GET /api/v1/admin/materials/:id
   * @access  Staff (read-only), Admin
   */
  getMaterialById: asyncHandler(async (req, res) => {
    const result = await materialService.getMaterialById(req.params.id);
    res.json(result);
  }),

  /**
   * @desc    Tạo chất liệu mới
   * @route   POST /api/v1/admin/materials
   * @access  Admin Only
   */
  createMaterial: asyncHandler(async (req, res) => {
    const result = await materialService.createMaterial(req.body);
    res.status(201).json(result);
  }),

  /**
   * @desc    Cập nhật thông tin chất liệu
   * @route   PUT /api/v1/admin/materials/:id
   * @access  Admin Only
   */
  updateMaterial: asyncHandler(async (req, res) => {
    const result = await materialService.updateMaterial(
      req.params.id,
      req.body
    );
    res.json(result);
  }),

  /**
   * @desc    Xóa chất liệu
   * @route   DELETE /api/v1/admin/materials/:id
   * @access  Admin Only
   */
  deleteMaterial: asyncHandler(async (req, res) => {
    const result = await materialService.deleteMaterial(
      req.params.id,
      req.user._id
    );
    res.json(result);
  }),

  /**
   * @desc    Khôi phục chất liệu đã xóa
   * @route   PUT /api/v1/admin/materials/:id/restore
   * @access  Admin Only
   */
  restoreMaterial: asyncHandler(async (req, res) => {
    const result = await materialService.restoreMaterial(req.params.id);
    res.json(result);
  }),

  /**
   * @desc    Lấy danh sách chất liệu công khai
   * @route   GET /api/v1/materials
   * @access  Public
   */
  getPublicMaterials: asyncHandler(async (req, res) => {
    const result = await materialService.getPublicMaterials();
    res.json(result);
  }),
};

module.exports = materialController;
