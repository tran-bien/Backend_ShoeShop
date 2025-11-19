const asyncHandler = require("express-async-handler");
const returnService = require("@services/return.service");

/**
 * ADMIN RETURN CONTROLLER
 * Chứa các endpoints dành cho Admin/Staff quản lý đổi trả hàng
 */

/**
 * LẤY DANH SÁCH YÊU CẦU ĐỔI/TRẢ HÀNG (ADMIN)
 * @access  Staff/Admin (requireStaffOrAdmin middleware)
 * @route   GET /api/v1/admin/returns?page=1&limit=20&status=pending
 */
const getReturnRequests = asyncHandler(async (req, res) => {
  const { page, limit, status, type, customerId } = req.query;

  const filters = {
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
    status,
    type,
  };

  if (customerId) {
    filters.customerId = customerId;
  }

  const result = await returnService.getReturnRequests(filters);

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * LẤY CHI TIẾT YÊU CẦU ĐỔI/TRẢ (ADMIN)
 * @access  Staff/Admin (requireStaffOrAdmin middleware)
 * @route   GET /api/v1/admin/returns/:id
 */
const getReturnRequestDetail = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const isAdmin = true; // Admin always has access

  const returnRequest = await returnService.getReturnRequestById(
    id,
    userId,
    isAdmin
  );

  res.status(200).json({
    success: true,
    data: returnRequest,
  });
});

/**
 * DUYỆT YÊU CẦU ĐỔI/TRẢ HÀNG
 * @access  Staff/Admin (requireStaffOrAdmin middleware)
 * @route   PATCH /api/v1/admin/returns/:id/approve
 */
const approveReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const returnRequest = await returnService.approveReturnRequest(id, {
    approvedBy: req.user._id,
    note,
  });

  res.status(200).json({
    success: true,
    message: "Phê duyệt yêu cầu đổi trả thành công",
    data: returnRequest,
  });
});

/**
 * TỪ CHỐI YÊU CẦU ĐỔI/TRẢ HÀNG
 * @access  Staff/Admin (requireStaffOrAdmin middleware)
 * @route   PATCH /api/v1/admin/returns/:id/reject
 */
const rejectReturnRequest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const returnRequest = await returnService.rejectReturnRequest(id, {
    rejectedBy: req.user._id,
    reason,
  });

  res.status(200).json({
    success: true,
    message: "Từ chối yêu cầu đổi trả",
    data: returnRequest,
  });
});

/**
 * XỬ LÝ TRẢ HÀNG (HOÀN TIỀN)
 * @access  Staff/Admin (requireStaffOrAdmin middleware)
 * @route   POST /api/v1/admin/returns/:id/process-return
 */
const processReturn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const result = await returnService.processReturn(id, {
    processedBy: req.user._id,
    note,
  });

  res.status(200).json({
    success: true,
    message: "Xử lý hoàn trả thành công",
    data: result,
  });
});

/**
 * XỬ LÝ ĐỔI HÀNG
 * @access  Staff/Admin (requireStaffOrAdmin middleware)
 * @route   POST /api/v1/admin/returns/:id/process-exchange
 */
const processExchange = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const result = await returnService.processExchange(id, {
    processedBy: req.user._id,
    note,
  });

  res.status(200).json({
    success: true,
    message: "Xử lý đổi hàng thành công",
    data: result,
  });
});

/**
 * LẤY THỐNG KÊ YÊU CẦU ĐỔI/TRẢ HÀNG
 * @access  Staff/Admin (requireStaffOrAdmin middleware)
 * @route   GET /api/v1/admin/returns/stats/summary
 */
const getReturnStats = asyncHandler(async (req, res) => {
  const stats = await returnService.getReturnStats();

  res.status(200).json({
    success: true,
    data: stats,
  });
});

module.exports = {
  getReturnRequests,
  getReturnRequestDetail,
  approveReturnRequest,
  rejectReturnRequest,
  processReturn,
  processExchange,
  getReturnStats,
};
