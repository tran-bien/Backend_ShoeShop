const asyncHandler = require("express-async-handler");
const useCaseService = require("@services/useCase.service");

const useCaseController = {
  /**
   * @desc    Lấy danh sách nhu cầu sử dụng
   * @route   GET /api/v1/admin/use-cases
   * @access  Staff (read-only), Admin
   */
  getAllUseCases: asyncHandler(async (req, res) => {
    const result = await useCaseService.getAllUseCases(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy danh sách nhu cầu sử dụng đã xóa
   * @route   GET /api/v1/admin/use-cases/deleted
   * @access  Staff (read-only), Admin
   */
  getDeletedUseCases: asyncHandler(async (req, res) => {
    const result = await useCaseService.getDeletedUseCases(req.query);
    res.json(result);
  }),

  /**
   * @desc    Lấy chi tiết nhu cầu sử dụng
   * @route   GET /api/v1/admin/use-cases/:id
   * @access  Staff (read-only), Admin
   */
  getUseCaseById: asyncHandler(async (req, res) => {
    const result = await useCaseService.getUseCaseById(req.params.id);
    res.json(result);
  }),

  /**
   * @desc    Tạo nhu cầu sử dụng mới
   * @route   POST /api/v1/admin/use-cases
   * @access  Admin Only
   */
  createUseCase: asyncHandler(async (req, res) => {
    const result = await useCaseService.createUseCase(req.body);
    res.status(201).json(result);
  }),

  /**
   * @desc    Cập nhật thông tin nhu cầu sử dụng
   * @route   PUT /api/v1/admin/use-cases/:id
   * @access  Admin Only
   */
  updateUseCase: asyncHandler(async (req, res) => {
    const result = await useCaseService.updateUseCase(req.params.id, req.body);
    res.json(result);
  }),

  /**
   * @desc    Xóa nhu cầu sử dụng
   * @route   DELETE /api/v1/admin/use-cases/:id
   * @access  Admin Only
   */
  deleteUseCase: asyncHandler(async (req, res) => {
    const result = await useCaseService.deleteUseCase(
      req.params.id,
      req.user._id
    );
    res.json(result);
  }),

  /**
   * @desc    Cập nhật trạng thái kích hoạt nhu cầu sử dụng
   * @route   PATCH /api/v1/admin/use-cases/:id/status
   * @access  Admin Only
   */
  updateUseCaseStatus: asyncHandler(async (req, res) => {
    const result = await useCaseService.updateUseCaseStatus(
      req.params.id,
      req.body.isActive
    );
    res.json(result);
  }),

  /**
   * @desc    Khôi phục nhu cầu sử dụng đã xóa
   * @route   PUT /api/v1/admin/use-cases/:id/restore
   * @access  Admin Only
   */
  restoreUseCase: asyncHandler(async (req, res) => {
    const result = await useCaseService.restoreUseCase(req.params.id);
    res.json(result);
  }),

  /**
   * @desc    Lấy danh sách nhu cầu sử dụng công khai
   * @route   GET /api/v1/use-cases
   * @access  Public
   */
  getPublicUseCases: asyncHandler(async (req, res) => {
    const result = await useCaseService.getPublicUseCases();
    res.json(result);
  }),
};

module.exports = useCaseController;
